import { useState } from "react";

import { Button, Input, Td } from "@app/components/v2";

import { decrypt } from "../utils/aes256";

// allows user to decrypt their secrets in place using the password
export const ValueCell = ({ value }: { value: string | null }) => {
  type ValueCellState = "encrypted" | "password" | "decrypting" | "decrypted" | "expired" | "error";

  const [state, update] = useState<ValueCellState>(value ? "encrypted" : "expired");
  const [password, setPassword] = useState("");
  const [decryptedValue, setDecryptedValue] = useState<string | null>(null);

  const onShowValue = async () => {
    update("decrypting");
    try {
      if (!value) {
        throw new Error("Value is missing");
      }
      const decrypted = await decrypt(value, password);
      setDecryptedValue(decrypted);
      update("decrypted");
    } catch (err) {
      update("error");
    }
  };

  const onHide = () => {
    setDecryptedValue(null);
    setPassword("");
    update("encrypted");
  };

  return (
    <Td className="flex items-center gap-2">
      {state === "encrypted" && (
        <Button
          onClick={() => {
            update("password");
          }}
        >
          Decrypt
        </Button>
      )}
      {state === "password" && (
        <form onSubmit={onShowValue} className="contents">
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit">Show Value</Button>
        </form>
      )}
      {state === "decrypted" && (
        <>
          <span>{decryptedValue}</span>
          <Button onClick={onHide}>Hide</Button>
        </>
      )}
      {state === "expired" && <span>Expired</span>}
      {state === "error" && (
        <>
          <span>Failed to decrypt value</span>
          <Button onClick={() => update("password")}>Retry</Button>
        </>
      )}
    </Td>
  );
};
