import { Knex } from "knex";

import { TableName } from "../schemas";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TableName.SharedSecrets, (table) => {
    table.uuid("id").primary().defaultTo(knex.fn.uuid());
    table.string("data").nullable();
    table.timestamp("createdAt").defaultTo(knex.fn.now());
    table.timestamp("expiresAt").notNullable();
    table.boolean("singleUse");

    table.uuid("userId").notNullable().references("id").inTable(TableName.Users);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TableName.SharedSecrets);
}
