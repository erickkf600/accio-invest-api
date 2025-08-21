import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class Change extends BaseSchema {
  protected tableName = 'changes'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string("change_type", 70).notNullable().unique()
      table.string("change_type_title", 70).notNullable().unique()
      table.timestamp('created_at', { useTz: true }).nullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).nullable()
      // table.collate('utf8_unicode_ci')
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
