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
        '.env',
        'src/uploads',
        'tmp',
        'coverage'
      ],
      
      // Development environment
      env: {
        NODE_ENV: 'development',
        PORT: 5000,
        MONGODB_URI: process.env.MONGODB_URI,
        JWT_SECRET: process.env.JWT_SECRET,
        JWT_EXPIRES_IN: '7d',
        JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
        JWT_REFRESH_EXPIRES_IN: '30d',
        COOKIE_EXPIRE: 7,
        EMAIL_HOST: 'smtp.ethereal.email',
        EMAIL_PORT: 587,
        EMAIL_USERNAME: process.env.EMAIL_USERNAME,
        EMAIL_PASSWORD: process.env.EMAIL_PASSWORD,
        EMAIL_FROM: process.env.EMAIL_FROM,
        STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
        STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
        CLIENT_URL: 'http://localhost:3000',
        RATE_LIMIT_WINDOW_MS: 900000, // 15 minutes
        RATE_LIMIT_MAX_REQUESTS: 100
      },
      
      // Production environment
      env_production: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 10000,
        MONGODB_URI: process.env.MONGODB_URI_PROD || process.env.MONGODB_URI,
        JWT_SECRET: process.env.JWT_SECRET,
        JWT_EXPIRES_IN: '1h', // Shorter expiry in production
        JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
        JWT_REFRESH_EXPIRES_IN: '7d',
        COOKIE_EXPIRE: 1, // 1 day in production
        EMAIL_SERVICE: 'gmail',
        EMAIL_HOST: process.env.EMAIL_HOST || 'smtp.gmail.com',
        EMAIL_PORT: process.env.EMAIL_PORT || 587,
        EMAIL_USERNAME: process.env.EMAIL_USERNAME,
        EMAIL_PASSWORD: process.env.EMAIL_PASSWORD,
        EMAIL_FROM: process.env.EMAIL_FROM,
        STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
        STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
        CLIENT_URL: 'https://shoppy-globe-frontend-beta.vercel.app',
        CLIENT_URL_PROD: 'https://shoppy-globe-frontend-beta.vercel.app',
        RATE_LIMIT_WINDOW_MS: 900000, // 15 minutes
        RATE_LIMIT_MAX_REQUESTS: 50 // Stricter in production
      },
      
      // Staging environment
      env_staging: {
        NODE_ENV: 'staging',
        PORT: process.env.PORT || 5001,
        MONGODB_URI: process.env.MONGODB_URI_STAGING || process.env.MONGODB_URI,
        JWT_SECRET: process.env.JWT_SECRET,
        JWT_EXPIRES_IN: '2h',
        JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
        JWT_REFRESH_EXPIRES_IN: '14d',
        COOKIE_EXPIRE: 2,
        EMAIL_HOST: process.env.EMAIL_HOST || 'smtp.gmail.com',
        EMAIL_PORT: process.env.EMAIL_PORT || 587,
        EMAIL_USERNAME: process.env.EMAIL_USERNAME,
        EMAIL_PASSWORD: process.env.EMAIL_PASSWORD,
        EMAIL_FROM: process.env.EMAIL_FROM,
        STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
        STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
        CLIENT_URL: process.env.CLIENT_URL_STAGING || 'https://staging-shoppy-globe.vercel.app',
        RATE_LIMIT_WINDOW_MS: 900000,
        RATE_LIMIT_MAX_REQUESTS: 75
      },
      
      // Logging configuration
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      log_type: 'json',
      
      // Performance and memory management
      max_memory_restart: process.env.NODE_ENV === 'production' ? '512M' : '1G',
      node_args: process.env.NODE_ENV === 'production' 
        ? '--max-old-space-size=512 --optimize-for-size' 
        : '--max-old-space-size=1024',
      
      // Restart configuration
      min_uptime: '10s',
      max_restarts: 15,
      autorestart: true,
      restart_delay: 4000,
      
      // Health monitoring
      health_check_grace_period: 3000000,
      health_check_fatal_exceptions: true,
      
      // Graceful shutdown and startup
      kill_timeout: 5000,
      listen_timeout: 3000,
      wait_ready: true,
      
      // Advanced PM2 features
      increment_var: 'PORT',
      force: true,
      
      // Load environment file
      env_file: '.env',
      
      // Cron restart (optional - restart every day at 2 AM in production)
      cron_restart: process.env.NODE_ENV === 'production' ? '0 2 * * *' : undefined,
      
      // Source map support
      source_map_support: true,
      
      // Instance variable
      instance_var: 'INSTANCE_ID'
    }
  ],

  // PM2 deployment configuration for VPS/dedicated servers
  deploy: {
    production: {
      user: 'ubuntu',
      host: ['your-production-server-ip'], // Replace with your server IP
      ref: 'origin/main',
      repo: 'https://github.com/your-username/shoppyglobe-backend.git', // Replace with your repo
      path: '/var/www/shoppyglobe-backend',
      'pre-deploy-local': '',
      'post-deploy': 'npm ci --production && npm run build && pm2 reload ecosystem.config.js --env production && pm2 save',
      'pre-setup': 'sudo mkdir -p /var/www && sudo chown ubuntu:ubuntu /var/www',
      'post-setup': 'pm2 install pm2-server-monit',
      ssh_options: 'StrictHostKeyChecking=no',
      env: {
        NODE_ENV: 'production'
      }
    },
    
    staging: {
      user: 'ubuntu',
      host: ['your-staging-server-ip'], // Replace with your staging server IP
      ref: 'origin/develop',
      repo: 'https://github.com/your-username/shoppyglobe-backend.git', // Replace with your repo
      path: '/var/www/shoppyglobe-backend-staging',
      'pre-deploy-local': '',
      'post-deploy': 'npm ci && pm2 reload ecosystem.config.js --env staging && pm2 save',
      'pre-setup': 'sudo mkdir -p /var/www && sudo chown ubuntu:ubuntu /var/www',
      ssh_options: 'StrictHostKeyChecking=no',
      env: {
        NODE_ENV: 'staging'
      }
    }
  }
};
