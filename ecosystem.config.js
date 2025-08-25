module.exports = {
  apps: [
    {
      name: 'shoppyglobe-api',
      script: 'server.js',
      instances: process.env.NODE_ENV === 'production' ? 'max' : 1,
      exec_mode: process.env.NODE_ENV === 'production' ? 'cluster' : 'fork',
      watch: process.env.NODE_ENV !== 'production',
      ignore_watch: [
        'node_modules',
        'logs',
        'uploads',
        '*.log',
        '.git',
        '.env'
      ],
      env: {
        NODE_ENV: 'development',
        PORT: 5000,
        MONGODB_URI: process.env.MONGODB_URI,
        JWT_SECRET: process.env.JWT_SECRET,
        EMAIL_USERNAME: process.env.EMAIL_USERNAME,
        EMAIL_PASSWORD: process.env.EMAIL_PASSWORD,
        STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
        CLIENT_URL: 'http://localhost:3000'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 5000,
        MONGODB_URI: process.env.MONGODB_URI_PROD || process.env.MONGODB_URI,
        JWT_SECRET: process.env.JWT_SECRET,
        EMAIL_USERNAME: process.env.EMAIL_USERNAME,
        EMAIL_PASSWORD: process.env.EMAIL_PASSWORD,
        STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
        CLIENT_URL: process.env.CLIENT_URL_PROD || process.env.CLIENT_URL
      },
      env_staging: {
        NODE_ENV: 'staging',
        PORT: process.env.PORT || 5001,
        MONGODB_URI: process.env.MONGODB_URI,
        JWT_SECRET: process.env.JWT_SECRET,
        EMAIL_USERNAME: process.env.EMAIL_USERNAME,
        EMAIL_PASSWORD: process.env.EMAIL_PASSWORD,
        STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
        CLIENT_URL: process.env.CLIENT_URL
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=1024',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      min_uptime: '10s',
      max_restarts: 10,
      autorestart: true,
      
      // Health check
      health_check_grace_period: 3000000,
      health_check_fatal_exceptions: true,
      
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 3000,
      
      // Advanced PM2 features
      increment_var: 'PORT',
      force: true,
      
      // Environment-specific overrides
      env_file: '.env'
    }
  ],

  // PM2 deployment configuration
  deploy: {
    production: {
      user: 'ubuntu',
      host: ['your-server-ip'],
      ref: 'origin/main',
      repo: 'https://github.com/your-username/shoppyglobe-backend.git',
      path: '/var/www/shoppyglobe-backend',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': '',
      ssh_options: 'StrictHostKeyChecking=no'
    },
    staging: {
      user: 'ubuntu',
      host: ['your-staging-server-ip'],
      ref: 'origin/develop',
      repo: 'https://github.com/your-username/shoppyglobe-backend.git',
      path: '/var/www/shoppyglobe-backend-staging',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env staging'
    }
  }
};