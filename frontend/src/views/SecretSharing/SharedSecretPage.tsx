import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import Image from "next/image";
import { useRouter } from "next/router";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button, FormControl, Input } from "@app/components/v2";
import { useSharedSecret } from "@app/hooks/api/secretSharing";

import { decrypt } from "./utils/aes256";

export const SharedSecretPage = () => {
  const {
    query: { id },
    replace
  } = useRouter();

  const { data, isLoading } = useSharedSecret(id as string);

  const schema = z.object({
    password: z.string().nonempty()
  });

  const [decrypted, setDecrypted] = useState<string | null>(null);

  const onDecrypt = async (form: any) => {
    if (data && data.data) {
      const result = await decrypt(data.data, form.password);
      setDecrypted(result);
    }
  };

  const { handleSubmit, control } = useForm({
    resolver: zodResolver(schema)
  });

  if (!isLoading && !data) {
    // NOTE: this works because nothing's handling /404 so coincidentally it will show 404
    replace("/404");
    return null;
  }

  return (
    <div className="dark mx-auto flex h-screen w-full max-w-2xl flex-col overflow-x-hidden">
      <header className="flex justify-center pt-8">
        <Image src="/images/gradientLogo.svg" height={90} width={120} alt="Infisical logo" />
      </header>
      <div className="flex flex-grow flex-col overflow-y-hidden md:flex-row">
        <div className="flex h-full w-full flex-grow flex-col justify-center overflow-y-auto bg-bunker-800 p-6 md:w-1/2">
          <h2 className="text-center text-3xl font-semibold text-gray-200">
            Someone shared a secret with you
          </h2>
          <p className="text-center text-bunker-300">Enter the password below to unlock it</p>
          <div className="mt-10 flex flex-col">
            <div className="mt-2 flex flex-col">
              <div className="flex flex-col rounded-lg border border-mineshaft-600 bg-mineshaft-900 p-4">
                {decrypted ? (
                  <p className="text-white">{decrypted}</p>
                ) : (
                  /* Fun little easter egg for those who try reading the blurred text */
                  <p className="select-none break-all text-transparent [text-shadow:0_0_10px_rgba(255,255,255,.8)]">
                    Infisical is hiring! https://infisical.com/careers
                  </p>
                )}
              </div>

              <form onSubmit={handleSubmit(onDecrypt)} className="flex justify-center py-4">
                <Controller
                  control={control}
                  name="password"
                  render={({ field, fieldState: { error } }) => (
                    <FormControl
                      label="Use password to unlock"
                      isError={Boolean(error)}
                      errorText={error?.message}
                    >
                      <div className="flex gap-2">
                        <Input {...field} placeholder="Password" type="password" />
                        <Button type="submit">Unlock</Button>
                      </div>
                    </FormControl>
                  )}
                />
              </form>
            </div>
          </div>
        </div>
      </div>
      <footer>
        <div className="flex justify-center p-4 text-white">
          <p className="text-sm">
            Powered by{" "}
            <a
              href="https://infisical.com"
              target="_blank"
              rel="noreferrer"
              className="text-primary-500"
            >
              Infisical
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
};
