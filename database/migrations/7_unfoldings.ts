import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class Unfoldings extends BaseSchema {
  protected tableName = 'unfoldings'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string("cod", 20)
      table.string("date_operation", 11).notNullable()
      table.integer("from", 20).notNullable()
      table.integer("to", 5).notNullable()
      table.integer("factor", 10).unsigned().references('changes.id').notNullable().onDelete('CASCADE').onUpdate('CASCADE')
      table.integer("year", 4).nullable()
      table.text("obs").nullable()
      table.decimal('total', 15, 10).nullable()
      table.integer("user_id", 20) .unsigned().references('users.id').notNullable().onDelete('CASCADE').onUpdate('CASCADE')
      table.timestamp('created_at', { useTz: true }).nullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).nullable()
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
