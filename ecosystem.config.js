module.exports = {
  apps: [
    {
      name: "akhbar-cms",
      cwd: "/home/user1/live/akhbar-strapi",
      script: "npm",
      args: "run installAndBuild",
      env: {
        NODE_ENV: "production",
      },
      interpreter: "/home/user1/.nvm/versions/node/v14.21.1/bin/node",
    },
  ],
};
