// 개발 서버(npm start)용 프록시. 배포 환경은 public/_redirects 가 같은 역할을 한다.
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function setupProxy(app) {
  // 코인 로고: static.upbit.com 은 CORS 헤더가 없어 캡처 시 직접 못 그린다 → 동일 출처로 중계
  app.use(
    '/api/upbit-logo',
    createProxyMiddleware({
      target: 'https://static.upbit.com',
      changeOrigin: true,
      pathRewrite: { '^/api/upbit-logo': '/logos' },
    })
  );

  app.use(
    '/api/upbit',
    createProxyMiddleware({
      target: 'https://api.upbit.com',
      changeOrigin: true,
      pathRewrite: { '^/api/upbit': '/v1' },
    })
  );
};
