import Env from '@ioc:Adonis/Core/Env';
import axios from 'axios';

export default class Paperless{
  paperlessApiUrl = Env.get('PAPERLESS_HOST');
  paperlessApiToken = Env.get('PAPERLESS_TOKEN');

  public async upload(document: any){
    try {
      const response = await axios.post(`${this.paperlessApiUrl}/api/documents/post_document`, document, {
        headers: {
          'Authorization': `Token ${this.paperlessApiToken}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      console.log('Document uploaded successfully:', response.data);
      return response.data;
    } catch (error) {
      throw {
        code: 4,
        message: `Erro na API PAPERLESS`,
        details: error.response?.data || error.message,
        status: error.response?.status
    }
    }
  }

  public async listAll(){}
  public async view(id: any){}
}
