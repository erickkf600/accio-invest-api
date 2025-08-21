import { BaseModel, HasOne, column, hasOne } from '@ioc:Adonis/Lucid/Orm'
import { DateTime } from 'luxon'
import Type from './Type'
import User from './User'

export default class Asset extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public cod: string

  @column()
  public quantity: number

  @column()
  public type: number

  @column()
  public total_rendi: number

  @column()
  public medium_price: number

  @column()
  public total_fee: number

  @column()
  public user_id: number

  @column()
  public total: number

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public 	created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updated_at: DateTime

  @hasOne(() => Type, {
    localKey: 'type',
    foreignKey: 'id',
  })
  public assetsType: HasOne<typeof Type>

  @hasOne(() => User, {
    localKey: 'user_id',
    foreignKey: 'id',
  })
  public user: HasOne<typeof User>

}
