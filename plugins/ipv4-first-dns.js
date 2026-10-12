const { withMainApplication } = require('@expo/config-plugins');

// OkHttp (mạng của React Native) thử lần lượt từng địa chỉ. Trên mạng có IPv6 hỏng, kết nối IPv6 tới
// Google treo cả chục giây trước khi chuyển sang IPv4. Ưu tiên IPv4 để tránh chờ vô ích.
const IMPORT = 'import com.facebook.react.modules.network.OkHttpClientProvider';
const SETUP = `    OkHttpClientProvider.setOkHttpClientFactory {
      OkHttpClientProvider.createClientBuilder()
        .dns(object : okhttp3.Dns {
          override fun lookup(hostname: String): List<java.net.InetAddress> =
            okhttp3.Dns.SYSTEM.lookup(hostname).sortedBy { it is java.net.Inet6Address }
        })
        .build()
    }
`;

function patch(src) {
  if (src.includes('setOkHttpClientFactory')) return src;
  return src
    .replace('import expo.modules.ApplicationLifecycleDispatcher', `${IMPORT}\nimport expo.modules.ApplicationLifecycleDispatcher`)
    .replace('    loadReactNative(this)', `${SETUP}    loadReactNative(this)`);
}

module.exports = (config) =>
  withMainApplication(config, (cfg) => {
    cfg.modResults.contents = patch(cfg.modResults.contents);
    return cfg;
  });
module.exports.patch = patch;
