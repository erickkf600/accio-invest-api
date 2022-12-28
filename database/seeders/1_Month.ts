import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'
import Month from 'App/Models/Month'

export default class MouthSeeder extends BaseSeeder {
  public async run () {
    await Month.createMany([
      { title: 'Jan', num: 1, full_name: 'janeiro' },
      { title: 'Fev', num: 2, full_name: 'fevereiro' },
      { title: 'Mar', num: 3, full_name: 'março' },
      { title: 'Abr', num: 4, full_name: 'abril' },
      { title: 'Mai', num: 5, full_name: 'maio' },
      { title: 'Jun', num: 6, full_name: 'junho' },
      { title: 'Jul', num: 7, full_name: 'julho' },
      { title: 'Ago', num: 8, full_name: 'agosto' },
      { title: 'Set', num: 9, full_name: 'setembro' },
      { title: 'Out', num: 10, full_name: 'outubro' },
      { title: 'Nov', num: 11, full_name: 'novembro' },
      { title: 'Dez', num: 12, full_name: 'dezembro' },
    ])
  }
}
