import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class Assets extends BaseSchema {
  protected tableName = 'assets'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string("cod", 20).notNullable().unique()
      table.integer("quantity", 8).notNullable()
      table.decimal("total_rendi", 15, 10).nullable()
      table.decimal("medium_price", 15, 10).nullable()
      table.decimal("total_fee", 15, 10).nullable()
      table.decimal("total", 15, 10).nullable()
      table.integer("type", 5).unsigned().nullable().references('types.id').onDelete('CASCADE').onUpdate('CASCADE')
      table.timestamp('created_at', { useTz: true }).nullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).nullable()
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
