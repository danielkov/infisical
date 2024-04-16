import { useTranslation } from "react-i18next";
import Head from "next/head";

import { SharedSecretPage } from "@app/views/SecretSharing/SharedSecretPage";

const SecretSharing = () => {
  const { t } = useTranslation();

  return (
    <div className="h-full bg-bunker-800">
      <Head>
        <title>{t("common.head-title", { title: t("secret-sharing.title") })}</title>
        <link rel="icon" href="/infisical.ico" />
        <meta property="og:image" content="/images/message.png" />
      </Head>

      <SharedSecretPage />
    </div>
  );
};

export default SecretSharing;
