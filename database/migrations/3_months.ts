import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class Months extends BaseSchema {
  protected tableName = 'months'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string("title", 3).notNullable()
      table.integer("num", 3).notNullable()
      table.string("full_name", 11).notNullable()
      table.collate('utf8_unicode_ci')
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
