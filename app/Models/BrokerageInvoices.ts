import { DateTime } from 'luxon'
import { BaseModel, HasOne, column, hasOne } from '@ioc:Adonis/Lucid/Orm'
import Month from './Month'
import User from './User'

export default class BrokerageInvoices extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public name: string

  @column()
  public date_operation: string

  @column()
  public path: string

  @column()
  public month_ref: number

  @column()
  public year: number

  @column()
  public user_id: number

 @column.dateTime({ autoCreate: true })
  public 	created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updated_at: DateTime

  @hasOne(() => User, {
    localKey: 'user_id',
    foreignKey: 'id',
  })
  public user: HasOne<typeof User>

  @hasOne(() => Month, {
    localKey: 'month_ref',
    foreignKey: 'id',
  })
  public month: HasOne<typeof Month>
}
