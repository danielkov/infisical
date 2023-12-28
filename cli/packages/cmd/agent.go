/*
Copyright (c) 2023 Infisical Inc.
*/
package cmd

import (
	"bytes"
	"fmt"
	"io/ioutil"
	"os"
	"os/signal"
	"path"
	"strings"
	"sync"
	"syscall"
	"text/template"
	"time"

	"github.com/rs/zerolog/log"
	"gopkg.in/yaml.v2"

	"github.com/Infisical/infisical-merge/packages/api"
	"github.com/Infisical/infisical-merge/packages/config"
	"github.com/Infisical/infisical-merge/packages/models"
	"github.com/Infisical/infisical-merge/packages/util"
	"github.com/go-resty/resty/v2"
	"github.com/spf13/cobra"
)

const DEFAULT_INFISICAL_CLOUD_URL = "https://app.infisical.com"

type Config struct {
	Infisical InfisicalConfig `yaml:"infisical"`
	Auth      AuthConfig      `yaml:"auth"`
	Sinks     []Sink          `yaml:"sinks"`
	Templates []Template      `yaml:"templates"`
}

type InfisicalConfig struct {
	Address string `yaml:"address"`
}

type AuthConfig struct {
	Type   string      `yaml:"type"`
	Config interface{} `yaml:"config"`
}

type UniversalAuth struct {
	ClientIDPath             string `yaml:"client-id"`
	ClientSecretPath         string `yaml:"client-secret"`
	RemoveClientSecretOnRead bool   `yaml:"remove_client_secret_on_read"`
}

type OAuthConfig struct {
	ClientID     string `yaml:"client-id"`
	ClientSecret string `yaml:"client-secret"`
}

type Sink struct {
	Type   string      `yaml:"type"`
	Config SinkDetails `yaml:"config"`
}

type SinkDetails struct {
	Path string `yaml:"path"`
}

type Template struct {
	SourcePath      string `yaml:"source-path"`
	DestinationPath string `yaml:"destination-path"`
}

func ReadFile(filePath string) ([]byte, error) {
	return ioutil.ReadFile(filePath)
}

func FileExists(filepath string) bool {
	info, err := os.Stat(filepath)
	if os.IsNotExist(err) {
		return false
	}
	return !info.IsDir()
}

// WriteToFile writes data to the specified file path.
func WriteBytesToFile(data *bytes.Buffer, outputPath string) error {
	outputFile, err := os.Create(outputPath)
	if err != nil {
		return err
	}
	defer outputFile.Close()

	_, err = outputFile.Write(data.Bytes())
	return err
}

func appendAPIEndpoint(address string) string {
	// Ensure the address does not already end with "/api"
	if strings.HasSuffix(address, "/api") {
		return address
	}

	// Check if the address ends with a slash and append accordingly
	if address[len(address)-1] == '/' {
		return address + "api"
	}
	return address + "/api"
}

func ParseAgentConfig(filePath string) (*Config, error) {
	data, err := ioutil.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	var rawConfig struct {
		Infisical InfisicalConfig `yaml:"infisical"`
		Auth      struct {
			Type   string                 `yaml:"type"`
			Config map[string]interface{} `yaml:"config"`
		} `yaml:"auth"`
		Sinks     []Sink     `yaml:"sinks"`
		Templates []Template `yaml:"templates"`
	}

	if err := yaml.Unmarshal(data, &rawConfig); err != nil {
		return nil, err
	}

	// Set defaults
	if rawConfig.Infisical.Address == "" {
		rawConfig.Infisical.Address = DEFAULT_INFISICAL_CLOUD_URL
	}

	config.INFISICAL_URL = appendAPIEndpoint(rawConfig.Infisical.Address)

	log.Info().Msgf("Infisical instance address set to %s", rawConfig.Infisical.Address)

	config := &Config{
		Infisical: rawConfig.Infisical,
		Auth: AuthConfig{
			Type: rawConfig.Auth.Type,
		},
		Sinks:     rawConfig.Sinks,
		Templates: rawConfig.Templates,
	}

	// Marshal and then unmarshal the config based on the type
	configBytes, err := yaml.Marshal(rawConfig.Auth.Config)
	if err != nil {
		return nil, err
	}

	switch rawConfig.Auth.Type {
	case "universal-auth":
		var tokenConfig UniversalAuth
		if err := yaml.Unmarshal(configBytes, &tokenConfig); err != nil {
			return nil, err
		}

		config.Auth.Config = tokenConfig
	case "oauth": // aws, gcp, k8s service account, etc
		var oauthConfig OAuthConfig
		if err := yaml.Unmarshal(configBytes, &oauthConfig); err != nil {
			return nil, err
		}
		config.Auth.Config = oauthConfig
	default:
		return nil, fmt.Errorf("unknown auth type: %s", rawConfig.Auth.Type)
	}

	return config, nil
}

func secretTemplateFunction(accessToken string) func(string, string, string) ([]models.SingleEnvironmentVariable, error) {
	return func(projectID, envSlug, secretPath string) ([]models.SingleEnvironmentVariable, error) {
		secrets, err := util.GetPlainTextSecretsViaMachineIdentity(accessToken, projectID, envSlug, secretPath, false)
		if err != nil {
			return nil, err
		}

		return secrets, nil
	}
}

func ProcessTemplate(templatePath string, data interface{}, accessToken string) (*bytes.Buffer, error) {
	// custom template function to fetch secrets from Infisical
	secretFunction := secretTemplateFunction(accessToken)
	funcs := template.FuncMap{
		"secret": secretFunction,
	}

	templateName := path.Base(templatePath)

	tmpl, err := template.New(templateName).Funcs(funcs).ParseFiles(templatePath)
	if err != nil {
		return nil, err
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return nil, err
	}

	return &buf, nil
}

type TokenManager struct {
	accessToken                    string
	accessTokenTTL                 time.Duration
	accessTokenMaxTTL              time.Duration
	accessTokenFetchedTime         time.Time
	accessTokenRefreshedTime       time.Time
	mutex                          sync.Mutex
	filePaths                      []Sink // Store file paths if needed
	templates                      []Template
	clientIdPath                   string
	clientSecretPath               string
	newAccessTokenNotificationChan chan bool
	removeClientSecretOnRead       bool
	cachedClientSecret             string
}

func NewTokenManager(fileDeposits []Sink, templates []Template, clientIdPath string, clientSecretPath string, newAccessTokenNotificationChan chan bool, removeClientSecretOnRead bool) *TokenManager {
	return &TokenManager{filePaths: fileDeposits, templates: templates, clientIdPath: clientIdPath, clientSecretPath: clientSecretPath, newAccessTokenNotificationChan: newAccessTokenNotificationChan, removeClientSecretOnRead: removeClientSecretOnRead}
}

func (tm *TokenManager) SetToken(token string, accessTokenTTL time.Duration, accessTokenMaxTTL time.Duration) {
	tm.mutex.Lock()
	defer tm.mutex.Unlock()

	tm.accessToken = token
	tm.accessTokenTTL = accessTokenTTL
	tm.accessTokenMaxTTL = accessTokenMaxTTL

	tm.newAccessTokenNotificationChan <- true
}

func (tm *TokenManager) GetToken() string {
	tm.mutex.Lock()
	defer tm.mutex.Unlock()

	return tm.accessToken
}

func getMaxTTL(accessTokenTTL int, accessTokenMaxTTL *int) time.Duration {
	if accessTokenMaxTTL == nil {
		return time.Duration(accessTokenTTL * int(time.Second))
	}

	return time.Duration(*accessTokenMaxTTL * int(time.Second))
}

// Fetches a new access token using client credentials
func (tm *TokenManager) FetchNewAccessToken() error {
	clientIDAsByte, err := ReadFile(tm.clientIdPath)
	if err != nil {
		return fmt.Errorf("unable to read client id from file path '%s' due to error: %v", tm.clientIdPath, err)
	}

	clientSecretAsByte, err := ReadFile(tm.clientSecretPath)
	if err != nil {
		if len(tm.cachedClientSecret) == 0 {
			return fmt.Errorf("unable to read client secret from file and no cached client secret found: %v", err)
		} else {
			clientSecretAsByte = []byte(tm.cachedClientSecret)
		}
	}

	// remove client secret after first read
	if tm.removeClientSecretOnRead {
		os.Remove(tm.clientSecretPath)
	}

	clientId := string(clientIDAsByte)
	clientSecret := string(clientSecretAsByte)

	// save as cache in memory
	tm.cachedClientSecret = clientSecret

	err, loginResponse := universalAuthLogin(clientId, clientSecret)
	if err != nil {
		return err
	}

	accessTokenTTL := time.Duration(loginResponse.AccessTokenTTL * int(time.Second))
	// if max ttl is not set, set it to the same as ttl - this enables periodic refresh token
	accessTokenMaxTTL := getMaxTTL(loginResponse.AccessTokenTTL, loginResponse.AccessTokenMaxTTL)

	if accessTokenTTL <= time.Duration(5)*time.Second {
		util.PrintErrorMessageAndExit("At this this, agent does not support refresh of tokens with 5 seconds or less ttl. Please increase access token ttl and try again")
	}

	tm.accessTokenFetchedTime = time.Now()
	tm.SetToken(loginResponse.AccessToken, accessTokenTTL, accessTokenMaxTTL)

	return nil
}

// Refreshes the existing access token
func (tm *TokenManager) RefreshAccessToken() error {
	httpClient := resty.New()
	httpClient.SetRetryCount(10000).
		SetRetryMaxWaitTime(20 * time.Second).
		SetRetryWaitTime(5 * time.Second)

	accessToken := tm.GetToken()
	response, err := api.CallUniversalAuthRefreshAccessToken(httpClient, api.UniversalAuthRefreshRequest{AccessToken: accessToken})
	if err != nil {
		return err
	}

	accessTokenTTL := time.Duration(response.AccessTokenTTL * int(time.Second))
	accessTokenMaxTTL := getMaxTTL(response.AccessTokenTTL, response.AccessTokenMaxTTL)
	tm.accessTokenRefreshedTime = time.Now()

	tm.SetToken(response.AccessToken, accessTokenTTL, accessTokenMaxTTL)

	return nil
}

func (tm *TokenManager) ManageTokenLifecycle() {
	for {
		accessTokenMaxTTLExpiresInTime := tm.accessTokenFetchedTime.Add(tm.accessTokenMaxTTL - (5 * time.Second))
		accessTokenRefreshedTime := tm.accessTokenRefreshedTime

		if accessTokenRefreshedTime.IsZero() {
			accessTokenRefreshedTime = tm.accessTokenFetchedTime
		}

		nextAccessTokenExpiresInTime := accessTokenRefreshedTime.Add(tm.accessTokenTTL - (5 * time.Second))

		if tm.accessTokenFetchedTime.IsZero() && tm.accessTokenRefreshedTime.IsZero() {
			// case: init login to get access token
			log.Info().Msg("attempting to authenticate...")
			err := tm.FetchNewAccessToken()
			if err != nil {
				log.Error().Msgf("unable to authenticate because %v. Will retry in 30 seconds", err)

				// wait a bit before trying again
				time.Sleep((30 * time.Second))
				continue
			}
		} else if time.Now().After(accessTokenMaxTTLExpiresInTime) {
			log.Info().Msgf("token has reached max ttl, attempting to re authenticate...")
			err := tm.FetchNewAccessToken()
			if err != nil {
				log.Error().Msgf("unable to authenticate because %v. Will retry in 30 seconds", err)

				// wait a bit before trying again
				time.Sleep((30 * time.Second))
				continue
			}
		} else {
			log.Info().Msgf("attempting to refresh existing token...")
			err := tm.RefreshAccessToken()
			if err != nil {
				log.Error().Msgf("unable to refresh token because %v. Will retry in 30 seconds", err)

				// wait a bit before trying again
				time.Sleep((30 * time.Second))
				continue
			}
		}

		if accessTokenRefreshedTime.IsZero() {
			accessTokenRefreshedTime = tm.accessTokenFetchedTime
		} else {
			accessTokenRefreshedTime = tm.accessTokenRefreshedTime
		}

		nextAccessTokenExpiresInTime = accessTokenRefreshedTime.Add(tm.accessTokenTTL - (5 * time.Second))
		accessTokenMaxTTLExpiresInTime = tm.accessTokenFetchedTime.Add(tm.accessTokenMaxTTL - (5 * time.Second))

		if nextAccessTokenExpiresInTime.After(accessTokenMaxTTLExpiresInTime) {
			// case: Refreshed so close that the next refresh would occur beyond max ttl (this is because currently, token renew tries to add +access-token-ttl amount of time)
			// example: access token ttl is 11 sec and max ttl is 30 sec. So it will start with 11 seconds, then 22 seconds but the next time you call refresh it would try to extend it to 33 but max ttl only allows 30, so the token will be valid until 30 before we need to reauth
			time.Sleep(tm.accessTokenTTL - nextAccessTokenExpiresInTime.Sub(accessTokenMaxTTLExpiresInTime))
		} else {
			time.Sleep(tm.accessTokenTTL - (5 * time.Second))
		}
	}
}

func (tm *TokenManager) WriteTokenToFiles() {
	token := tm.GetToken()
	for _, sinkFile := range tm.filePaths {
		if sinkFile.Type == "file" {
			err := ioutil.WriteFile(sinkFile.Config.Path, []byte(token), 0644)
			if err != nil {
				log.Error().Msgf("unable to write file sink to path '%s' because %v", sinkFile.Config.Path, err)
			}

			log.Info().Msgf("new access token saved to file at path '%s'", sinkFile.Config.Path)

		} else {
			log.Error().Msg("unsupported sink type. Only 'file' type is supported")
		}
	}
}

func (tm *TokenManager) FetchSecrets() {
	log.Info().Msgf("template engine started...")
	for {
		token := tm.GetToken()
		if token != "" {
			for _, secretTemplate := range tm.templates {
				processedTemplate, err := ProcessTemplate(secretTemplate.SourcePath, nil, token)
				if err != nil {
					log.Error().Msgf("template engine: unable to render secrets because %s. Will try again on next cycle", err)

					continue
				}

				if err := WriteBytesToFile(processedTemplate, secretTemplate.DestinationPath); err != nil {
					log.Error().Msgf("template engine: unable to write secrets to path because %s. Will try again on next cycle", err)

					continue
				}

				log.Info().Msgf("template engine: secret template at path %s has been rendered and saved to path %s", secretTemplate.SourcePath, secretTemplate.DestinationPath)
			}

			// fetch new secrets every 5 minutes (TODO: add PubSub in the future )
			time.Sleep(5 * time.Minute)
		}
	}
}

func universalAuthLogin(clientId string, clientSecret string) (error, api.UniversalAuthLoginResponse) {
	httpClient := resty.New()
	httpClient.SetRetryCount(10000).
		SetRetryMaxWaitTime(20 * time.Second).
		SetRetryWaitTime(5 * time.Second)

	tokenResponse, err := api.CallUniversalAuthLogin(httpClient, api.UniversalAuthLoginRequest{ClientId: clientId, ClientSecret: clientSecret})
	if err != nil {
		return err, api.UniversalAuthLoginResponse{}
	}

	return nil, tokenResponse
}

// runCmd represents the run command
var agentCmd = &cobra.Command{
	Example: `
	infisical agent
	`,
	Use:                   "agent",
	Short:                 "Used to launch a client daemon that streamlines authentication and secret retrieval processes in various environments",
	DisableFlagsInUseLine: true,
	Run: func(cmd *cobra.Command, args []string) {

		log.Info().Msg("starting Infisical agent...")

		configPath, err := cmd.Flags().GetString("config")
		if err != nil {
			util.HandleError(err, "Unable to parse flag config")
		}

		if !FileExists(configPath) {
			log.Error().Msgf("Unable to locate %s. The provided agent config file path is either missing or incorrect", configPath)
			return
		}

		agentConfig, err := ParseAgentConfig(configPath)
		if err != nil {
			log.Error().Msgf("Unable to prase %s because %v. Please ensure that is follows the Infisical Agent config structure", configPath, err)
			return
		}

		if agentConfig.Auth.Type != "universal-auth" {
			util.PrintErrorMessageAndExit("Only auth type of 'universal-auth' is supported at this time")
		}

		configUniversalAuthType := agentConfig.Auth.Config.(UniversalAuth)

		tokenRefreshNotifier := make(chan bool)
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

		filePaths := agentConfig.Sinks
		tm := NewTokenManager(filePaths, agentConfig.Templates, configUniversalAuthType.ClientIDPath, configUniversalAuthType.ClientSecretPath, tokenRefreshNotifier, configUniversalAuthType.RemoveClientSecretOnRead)

		go tm.ManageTokenLifecycle()
		go tm.FetchSecrets()

		for {
			select {
			case <-tokenRefreshNotifier:
				go tm.WriteTokenToFiles()
			case <-sigChan:
				log.Info().Msg("agent is gracefully shutting...")
				// TODO: check if we are in the middle of writing files to disk
				os.Exit(1)
			}
		}

	},
}

func init() {
	agentCmd.SetHelpFunc(func(command *cobra.Command, strings []string) {
		command.Flags().MarkHidden("domain")
		command.Parent().HelpFunc()(command, strings)
	})
	agentCmd.Flags().String("config", "agent-config.yaml", "The path to agent config yaml file")
	rootCmd.AddCommand(agentCmd)
}
