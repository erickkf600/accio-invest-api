import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class FixedIncome extends BaseSchema {
  protected tableName = 'fixed_incomes'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string("emissor", 50)
      table.string("interest_rate", 30)
      table.string("invest_type", 9)
      table.integer("title_type", 9).notNullable()
      table.string("date_operation", 11).notNullable()
      table.string("date_expiration", 11).nullable()
      table.integer("form", 9).notNullable()
      table.integer("index", 9).notNullable()
      table.text("obs").nullable()
      table.decimal('total', 15, 10).notNullable()
      table.boolean('daily_liquidity').notNullable()
      table.decimal('rentability', 15, 10).nullable()
      table.decimal('other_cost', 15, 10).nullable()
      table.integer("user_id", 20) .unsigned().references('users.id').notNullable().onDelete('CASCADE').onUpdate('CASCADE')
      table.boolean("expired").notNullable().defaultTo(0)
      table.timestamp('created_at', { useTz: true }).nullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).nullable()
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
