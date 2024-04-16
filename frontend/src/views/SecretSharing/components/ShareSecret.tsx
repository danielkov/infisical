import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { z } from "zod";

import { createNotification } from "@app/components/notifications";
import { Button, Checkbox, FormControl, Input, TextArea } from "@app/components/v2";
import { useCreateSharedSecret } from "@app/hooks/api/secretSharing";

import { encrypt } from "../utils/aes256";
import { DateTimePicker } from "./DateTimePicker";

const schema = z.object({
  value: z.string().nonempty(),
  password: z.string().nonempty(),
  expiresAt: z.date().refine((date) => date > new Date(), {
    message: "Expires at should be a future date"
  }),
  singleUse: z.boolean()
});

type FormData = z.infer<typeof schema>;

const createSharedSecretUrl = (id: string) => {
  return `${window.location.origin}/secret-sharing/${id}`;
};

export const ShareSecret = () => {
  const { t } = useTranslation();

  const mutation = useCreateSharedSecret();

  const onFormSubmit = async (data: any) => {
    const encrypted = await encrypt(data.value, data.password);
    await mutation.mutateAsync({
      data: encrypted,
      expiresAt: data.expiresAt,
      singleUse: data.singleUse
    });
  };

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting }
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      singleUse: false
    }
  });

  return (
    <motion.div
      key="panel-groups"
      transition={{ duration: 0.15 }}
      initial={{ opacity: 0, translateX: 30 }}
      animate={{ opacity: 1, translateX: 0 }}
      exit={{ opacity: 0, translateX: 30 }}
    >
      {mutation.data ? (
        <div className="flex h-96 flex-col items-center justify-center gap-4 text-white">
          <h2 className="text-center text-xl font-semibold">
            {t("secret-sharing.add-form.success")}
          </h2>
          <p className="max-w-[64ch] text-center">
            {t("secret-sharing.add-form.success-description")}
          </p>
          <div className="flex gap-2">
            <Input type="text" value={createSharedSecretUrl(mutation.data.id)} readOnly />
            <Button
              variant="plain"
              onClick={async () => {
                await navigator.clipboard.writeText(createSharedSecretUrl(mutation.data.id));
                createNotification({
                  type: "success",
                  text: t("secret-sharing.add-form.link-copied")
                });
              }}
            >
              {t("secret-sharing.add-form.copy-link")}
            </Button>
          </div>
          <Button
            className="btn-primary mt-4"
            onClick={() => {
              mutation.reset();
              reset();
            }}
          >
            {t("secret-sharing.add-form.add-another")}
          </Button>
        </div>
      ) : (
        <>
          <h2
            className="text-lg font-semibold
        text-white"
          >
            {t("secret-sharing.add-form.title")}
          </h2>
          <p className="text-bunker-300">{t("secret-sharing.add-form.description")}</p>

          <form onSubmit={handleSubmit(onFormSubmit)} className="py-4">
            <Controller
              control={control}
              name="value"
              defaultValue=""
              render={({ field, fieldState: { error } }) => (
                <FormControl
                  label={t("secret-sharing.add-form.value")}
                  isError={Boolean(error)}
                  errorText={error?.message}
                >
                  <TextArea {...field} placeholder="Add your secret here" />
                </FormControl>
              )}
            />
            <Controller
              control={control}
              name="password"
              defaultValue=""
              render={({ field, fieldState: { error } }) => (
                <FormControl
                  label={t("secret-sharing.add-form.password")}
                  isError={Boolean(error)}
                  errorText={error?.message}
                >
                  <Input {...field} type="password" />
                </FormControl>
              )}
            />
            <Controller
              control={control}
              name="expiresAt"
              render={({ field, fieldState: { error } }) => (
                <FormControl
                  label={t("secret-sharing.add-form.expires-at")}
                  isError={Boolean(error)}
                  errorText={error?.message}
                >
                  <DateTimePicker
                    {...field}
                    onValueChange={(value) => {
                      field.onChange(value);
                    }}
                    defaultPreset="1 hour"
                    minDate={new Date()}
                  />
                </FormControl>
              )}
            />

            <Controller
              control={control}
              name="singleUse"
              render={({ field: { value, onChange, onBlur, name } }) => (
                <FormControl label={t("secret-sharing.add-form.single-use")}>
                  <Checkbox id={name} isChecked={value} onCheckedChange={onChange} onBlur={onBlur}>
                    {t("secret-sharing.add-form.single-use-description")}
                  </Checkbox>
                </FormControl>
              )}
            />

            <Button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting || mutation.isLoading}
            >
              {t("secret-sharing.add-form.submit")}
            </Button>
          </form>
        </>
      )}
    </motion.div>
  );
};
