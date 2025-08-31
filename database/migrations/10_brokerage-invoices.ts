import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class Movements extends BaseSchema {
  protected tableName = 'brokerage_invoices'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string("name", 100)
      table.string("date_operation", 11).notNullable()
      table.string("path", 100).nullable()
      table.integer("month_ref", 3).unsigned().nullable().references('months.id').onDelete('CASCADE').onUpdate('CASCADE')
      table.integer("year", 4).nullable()
      table.integer("user_id", 20).unsigned().references('users.id').notNullable().onDelete('CASCADE').onUpdate('CASCADE')
      table.timestamp('created_at', { useTz: true }).nullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).nullable()
      // table.collate('utf8_unicode_ci')
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
