import { DateTime } from 'luxon'
import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'

export default class Change extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public change_type: string

  @column()
  public change_type_title: string

 @column.dateTime({ autoCreate: true })
  public 	created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updated_at: DateTime
}
