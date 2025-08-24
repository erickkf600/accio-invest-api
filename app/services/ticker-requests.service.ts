import Env from '@ioc:Adonis/Core/Env';
import axios from 'axios';

export default class TickerRequests {

  public async accioTickerDataRequest(symbols: any){
    const req = await axios.get(`${Env.get('TICKER_HOST')}/tickers?ticker=${symbols}`)
    .then(({data}) => {
      return data
    })
    .catch(() => {
      throw {
        code: 4,
        message: `Ocorreu um erro ao buscar na api ${Env.get('TICKER_HOST')}`,
      };
    })

    return req
  }
  public async accioTickerHistoryRequest(symbols: any, start: string, end: string){
    const req = await axios.get(`${Env.get('TICKER_HOST')}/tickers/history?ticker=${symbols}&=start${start}&end=${end}`)
    .then(({data}) => {
      return data
    })
    .catch(() => {
      throw {
        code: 4,
        message: `Ocorreu um erro ao buscar na api ${Env.get('TICKER_HOST')}`,
      };
    })

    return req
  }
  public async accioTickerEarningsRequest(body: any){
    const req = await axios.post(`${Env.get('TICKER_HOST')}/proventos`, body)
    .then(({ data }) => data)
    .catch((error) => {
        throw {
            code: 4,
            message: `Erro na API ${Env.get('TICKER_HOST')}`,
            details: error.response?.data || error.message,
            status: error.response?.status
        };
    });

    return req
  }

  public async cdiData(start: string, end: string){
    const req = await axios.get(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.4391/dados?formato=json&dataInicial=${start}&dataFinal=${end}`)
    .then((cdi) => {
      return cdi.data
    })
    .catch((err) => {
      throw {
        code: 4,
        message: `Ocorreu um erro ao buscar na api cdiData: ${err}`,
      };
    })

    return req
  }

  public async ipcaData(start: string, end: string){
    const req = await axios.get(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.10844/dados?formato=json&dataInicial=${start}&dataFinal=${end}`)
    .then((cdi) => {
      return cdi.data
    })
    .catch((err) => {
      throw {
        code: 4,
        message: `Ocorreu um erro ao buscar na api cdiData: ${err}`,
      };
    })

    return req
  }

  public async selicData(start: string, end: string){
    const req = await axios.get(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.11/dados?formato=json&dataInicial=${start}&dataFinal=${end}`)
    .then((cdi) => {
      return cdi.data
    })
    .catch((err) => {
      throw {
        code: 4,
        message: `Ocorreu um erro ao buscar na api cdiData: ${err}`,
      };
    })

    return req
  }
}
