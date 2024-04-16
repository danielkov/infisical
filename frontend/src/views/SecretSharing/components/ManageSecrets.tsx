import { useState } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";

import { createNotification } from "@app/components/notifications";
import {
  Button,
  EmptyState,
  Switch,
  Table,
  TableContainer,
  TableSkeleton,
  TBody,
  Td,
  Th,
  THead,
  Tr
} from "@app/components/v2";
import { useExpireSharedSecret, useSharedSecrets } from "@app/hooks/api/secretSharing";

import { createSharedSecretUrl } from "../utils/url";
import { ValueCell } from "./ValueCell";

export const ManageSecrets = () => {
  const [showExpired, onShowExpiredChange] = useState(false);

  const { isLoading, data = [] } = useSharedSecrets();

  const filteredData = data
    .filter((d) => (showExpired ? true : !d.expired))
    .map(({ createdAt, expiresAt, ...rest }) => ({
      ...rest,
      createdAt: new Date(createdAt),
      expiresAt: new Date(expiresAt)
    }));

  const mutation = useExpireSharedSecret();

  return (
    <motion.div
      key="panel-groups"
      transition={{ duration: 0.15 }}
      initial={{ opacity: 0, translateX: 30 }}
      animate={{ opacity: 1, translateX: 0 }}
      exit={{ opacity: 0, translateX: 30 }}
    >
      <div className="mb-6 rounded-lg border border-mineshaft-600 bg-mineshaft-900 p-4">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-lg font-semibold text-white">Your Shared Secrets</p>
          <Switch id="showExpired" onCheckedChange={onShowExpiredChange} isChecked={showExpired}>
            Show Expired
          </Switch>
        </div>
        <TableContainer>
          <Table>
            <THead>
              <Tr>
                <Th className="whitespace-nowrap">Created At</Th>
                <Th className="whitespace-nowrap">Expires At</Th>
                <Th className="w-full">Value</Th>
                <Th className="whitespace-nowrap">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {isLoading && <TableSkeleton columns={4} innerKey="project-groups" />}
              {!isLoading &&
                filteredData &&
                filteredData.length > 0 &&
                filteredData.map(({ id, createdAt, expiresAt, data: valueEncrypted, expired }) => {
                  return (
                    <Tr className="h-10" key={`st-v3-${id}`}>
                      <Td className="whitespace-nowrap">
                        {format(new Date(createdAt), "yyyy-MM-dd HH:mm")}
                      </Td>
                      <Td className="whitespace-nowrap">
                        {format(new Date(expiresAt), "yyyy-MM-dd HH:mm")}
                      </Td>
                      <ValueCell value={valueEncrypted} />
                      <Td className="space-x-2 whitespace-nowrap">
                        {expired ? null : (
                          <>
                            <Button
                              size="sm"
                              variant="outline_bg"
                              onClick={() => {
                                mutation.mutate(id);
                              }}
                              isLoading={mutation.isLoading}
                            >
                              Expire
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                const url = createSharedSecretUrl(id);
                                try {
                                  await navigator.clipboard.writeText(url);
                                  createNotification({
                                    type: "success",
                                    text: "Copied to clipboard"
                                  });
                                } catch {
                                  createNotification({
                                    type: "error",
                                    text: `Failed to copy to clipboard. Here's the url: ${url}`
                                  });
                                }
                              }}
                            >
                              Copy
                            </Button>
                          </>
                        )}
                      </Td>
                    </Tr>
                  );
                })}
            </TBody>
          </Table>
          {!isLoading && filteredData?.length === 0 ? (
            <EmptyState
              title={
                showExpired ? "You have not shared any secrets yet" : "You have no active secrets"
              }
            />
          ) : null}
        </TableContainer>
      </div>
    </motion.div>
  );
};
