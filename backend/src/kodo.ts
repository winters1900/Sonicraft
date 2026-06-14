// 七牛对象存储 Kodo 上传 —— 把前端录制的短指令音频上传换取公网 URL。
// 七牛 ASR 是“服务端回拉音频”模式（audio.url 必填），它访问不到 localhost，
// 因此本地/线上都需先把音频放到公网可达的存储（Kodo），再把 URL 交给 ASR。
import qiniu from 'qiniu';

export interface KodoConfig {
  ak: string;
  sk: string;
  bucket: string;
  domain: string;
  https: boolean;
}

export function getKodoConfig(): KodoConfig {
  return {
    ak: process.env.QINIU_KODO_AK ?? '',
    sk: process.env.QINIU_KODO_SK ?? '',
    bucket: process.env.QINIU_KODO_BUCKET ?? '',
    domain: process.env.QINIU_KODO_DOMAIN ?? '',
    https: String(process.env.QINIU_KODO_HTTPS ?? 'false') === 'true',
  };
}

export function hasKodo(): boolean {
  const c = getKodoConfig();
  return Boolean(c.ak && c.sk && c.bucket && c.domain);
}

export interface UploadResult {
  /** 公网可访问的音频 URL，交给七牛 ASR。 */
  url: string;
  /** 对象 key，便于识别后删除临时文件。 */
  key: string;
}

/** 上传音频 Buffer，返回公网 URL。key 形如 voice-asr/<时间戳>-<随机>.<ext>。 */
export function uploadAudio(buffer: Buffer, ext: string): Promise<UploadResult> {
  const cfg = getKodoConfig();
  const mac = new qiniu.auth.digest.Mac(cfg.ak, cfg.sk);
  const key = `voice-asr/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  // 上传凭证：限定 scope=bucket:key，5 分钟有效。
  const putPolicy = new qiniu.rs.PutPolicy({ scope: `${cfg.bucket}:${key}`, expires: 300 });
  const token = putPolicy.uploadToken(mac);

  const config = new qiniu.conf.Config();
  config.useHttpsDomain = false; // 上传走默认；区域由 SDK 自动探测
  const uploader = new qiniu.form_up.FormUploader(config);
  const putExtra = new qiniu.form_up.PutExtra();

  return new Promise((resolve, reject) => {
    uploader.put(token, key, buffer, putExtra, (err, body, info) => {
      if (err) return reject(err);
      if (info.statusCode !== 200) {
        return reject(new Error(`Kodo 上传失败 HTTP ${info.statusCode}: ${JSON.stringify(body).slice(0, 200)}`));
      }
      const scheme = cfg.https ? 'https' : 'http';
      resolve({ url: `${scheme}://${cfg.domain}/${key}`, key });
    });
  });
}

/** 识别完成后删除临时音频对象（best-effort，失败不影响主流程）。 */
export function deleteObject(key: string): void {
  const cfg = getKodoConfig();
  const mac = new qiniu.auth.digest.Mac(cfg.ak, cfg.sk);
  const config = new qiniu.conf.Config();
  const bucketManager = new qiniu.rs.BucketManager(mac, config);
  bucketManager.delete(cfg.bucket, key, () => {
    /* best-effort：忽略删除结果 */
  });
}
