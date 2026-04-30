module.exports = (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.status(200).json({
      applinks: {
        apps: [],
        details: [
          {
            appID: 'YOUR_TEAM_ID.com.markpie.app',
            paths: ['/wechat/*'],
          },
        ],
      },
    })
  }
