module.exports = (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.status(200).json({
      applinks: {
        apps: [],
        details: [
          {
            appID: 'H58Z24BP7C.com.markpie.app',
            paths: ['/wechat/*'],
          },
        ],
      },
    })
  }
