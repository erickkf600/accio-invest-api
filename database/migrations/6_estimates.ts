import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class Estimates extends BaseSchema {
  protected tableName = 'estimates'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string("cod", 20).notNullable()
      table.decimal('unity_value', 15, 2).nullable()
      table.decimal('total', 15, 2).nullable()
      table.integer("month_ref", 3).unsigned().nullable().references('months.id').onDelete('CASCADE').onUpdate('CASCADE')
      table.integer("year", 4).nullable()
      table.timestamp('created_at', { useTz: true }).nullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).nullable()
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
