import { BaseModel, column, HasOne, hasOne } from '@ioc:Adonis/Lucid/Orm'
import { DateTime } from 'luxon'
import Month from './Month'
import Operation from './Operation'
import Type from './Type'

export default class Movement extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public cod: string

  @column()
  public date_operation: string

  @column()
  public qtd: number

  @column()
  public type: number

  @column()
  public type_operation: number

  @column()
  public unity_value: number

  @column()
  public obs: string

  @column()
  public fee: number

  @column()
  public month_ref: number

  @column()
  public total: number

  @column()
  public dividends: number

  @column()
  public year: number

  // @column.dateTime({
  //   autoCreate: true,
  //   serialize: (value: DateTime | null) => {
  //     return value ? value.toFormat('yyyy-M-d') : value
  //   },
  //  })
  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public 	created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updated_at: DateTime

  @hasOne(() => Type, {
    localKey: 'type',
    foreignKey: 'id',
  })
  public assetsType: HasOne<typeof Type>

  @hasOne(() => Operation, {
    localKey: 'type_operation',
    foreignKey: 'id',
  })
  public typeOperation: HasOne<typeof Operation>

  @hasOne(() => Month, {
    localKey: 'month_ref',
    foreignKey: 'id',
  })
  public month: HasOne<typeof Month>

}
