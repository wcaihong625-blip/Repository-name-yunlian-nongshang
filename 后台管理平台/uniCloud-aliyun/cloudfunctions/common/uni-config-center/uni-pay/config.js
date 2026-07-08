const fs = require('fs')
const path = require('path')

module.exports = {
  notifyUrl: {
    'mp-ab506838-a8d9-4b39-b973-ccf131ef8a18': 'https://fc-mp-ab506838-a8d9-4b39-b973-ccf131ef8a18.next.bspapp.com/uni-pay-co'
  },

  wxpay: {
    enable: true,
    mp: {
      appId: 'wxd99b4bc1e6c61afd',
      secret: 'd8177a40ef59d257c496e7dc61a25511',
      mchId: '1111211118',
      key: '',
      pfx: fs.readFileSync(path.join(__dirname, 'wxpay/apiclient_cert.p12')),
      v3Key: 'A7kP9mQ2Xc4R8vTyL1nD6sF3hJ5wB0eU',
      appCertPath: path.join(__dirname, 'wxpay/apiclient_cert.pem'),
      appPrivateKeyPath: path.join(__dirname, 'wxpay/apiclient_key.pem'),
      wxpayPublicKeyPath: path.join(__dirname, 'wxpay/wechatpay_public_cert.pem'),
      wxpayPublicKeyId: 'PUB_KEY_ID_0111112111182026041400211962003008',
      version: 3
    }
  }
}
