import { BaseModel, HasOne, column, hasOne } from '@ioc:Adonis/Lucid/Orm'
import { DateTime } from 'luxon'
import User from './User'

export default class FixedIncome extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public emissor: string

  @column()
  public interest_rate: string

  @column()
  public invest_type: string

  @column()
  public title_type: number

  @column()
  public date_operation: string

  @column()
  public date_expiration: string

  @column()
  public form: number

  @column()
  public index: number

  @column()
  public obs: string

  @column()
  public total: number

  @column()
  public daily_liquidity: number

  @column()
  public rentability: number

  @column()
  public other_cost: number

  @column()
  public user_id: number

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public 	created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updated_at: DateTime

  @hasOne(() => User, {
    localKey: 'user_id',
    foreignKey: 'id',
  })
  public user: HasOne<typeof User>
}
