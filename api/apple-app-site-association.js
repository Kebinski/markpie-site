module.exports = (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.status(200).json({
      applinks: {
        apps: [],
        details: [
          {
            appID: 'S7NV8C9UQ2.com.markpie.app',
            paths: ['/wechat/*'],
          },
        ],
      },
    })
  }
