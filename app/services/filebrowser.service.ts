import Env from '@ioc:Adonis/Core/Env';
import axios from 'axios';
import FormData from 'form-data'
import fs from 'fs';

export default class FileBrowser{
  ApiUrl = Env.get('FILEBROWSER_HOST');
  token
  private timer: NodeJS.Timeout | null = null;
  private timeout = 1.5 * 60 * 60 * 1000
  public async auth() {
    try {
      const response = await axios.post(`${this.ApiUrl}/api/login`, {
        username: Env.get('FILEBROWSER_USER'),
        password: Env.get('FILEBROWSER_PASSWORD')
      });
      this.token = response.data.token || response.data;
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        this.token = null;
        console.log('Token expirou e foi resetado automaticamente.');
      }, this.timeout);
      return response.data;
    } catch (error) {
      throw {
        code: 4,
        message: `Erro na API FileBrowser`,
        details: error.response?.data || error.message,
        status: error.response?.status
      }
    }
  }

  public async upload(file_content: any, document: any){
    try {
      const form = new FormData()
      form.append(document.fieldName, fs.createReadStream(document.tmpPath!), document.clientName)
      const response = await axios.post(`${this.ApiUrl}/api/resources/${file_content}?overwrite=false`, form, {
        headers: {
          'x-auth': this.token,
        },
      });
      return response.data;
    } catch (error) {
      throw {
        code: 4,
        message: `Erro na subida do documento: ${error}`,
      }
    }
  }

  public async viewFile(filePath: string) {
    const url = `${this.ApiUrl}/api/raw/${filePath}`;
    // const url = `${this.ApiUrl}/api/files/${filePath}`;
    // const url = `${this.ApiUrl}/api/resources/${filePath}`;

    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'arraybuffer',
      headers: {
        'X-Auth': this.token,
        'Content-Type': 'application/json'
      }
    });
    return response.data

    // const writer = fs.createWriteStream('DownloadedTextFile.pdf');

    // response.data.pipe(writer);

    // return new Promise((resolve, reject) => {
    //   writer.on('finish', resolve);
    //   writer.on('error', reject);
    // });
  }
}
