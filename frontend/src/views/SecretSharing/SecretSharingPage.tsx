import { useTranslation } from "react-i18next";

import { Tab, TabList, TabPanel, Tabs } from "@app/components/v2";

import { ManageSecrets } from "./components/ManageSecrets";
import { ShareSecret } from "./components/ShareSecret";

enum TabSections {
  Share = "share",
  Manage = "manage"
}

export const SecretSharingPage = () => {
  const { t } = useTranslation();

  return (
    <div className="container mx-auto h-full w-full max-w-7xl bg-bunker-800 px-6 text-white">
      <div className="flex items-center justify-between py-6">
        <div className="flex w-full flex-col">
          <h2 className="text-3xl font-semibold text-gray-200">{t("secret-sharing.title")}</h2>
          <p className="text-bunker-300">{t("secret-sharing.description")}</p>
        </div>
      </div>
      <Tabs defaultValue={TabSections.Share}>
        <TabList>
          <Tab value={TabSections.Share}>Share Secret</Tab>
          <Tab value={TabSections.Manage}>Manage Secrets</Tab>
        </TabList>
        <TabPanel value={TabSections.Share}>
          <ShareSecret />
        </TabPanel>
        <TabPanel value={TabSections.Manage}>
          <ManageSecrets />
        </TabPanel>
      </Tabs>
    </div>
  );
};
