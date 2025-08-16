import { DateTime } from 'luxon'
import { BaseModel, HasOne, column, hasOne } from '@ioc:Adonis/Lucid/Orm'
import Operation from './Operation'
import Month from './Month'
import Type from './Type'
import Change from './Change'

export default class Unfolding extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public cod: string

  @column()
  public date_operation: string

  @column()
  public type: number

  @column()
  public from: number

  @column()
  public to: number

  @column()
  public factor: number

  @column()
  public type_operation: number

  @column()
  public obs: string

  @column()
  public month_ref: number

  @column()
  public total: number

  @column()
  public year: number

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

  @hasOne(() => Change, {
    localKey: 'factor',
    foreignKey: 'id',
  })
  public change: HasOne<typeof Change>
}
