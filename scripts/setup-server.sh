#!/bin/bash
# ============================================================
# Setup do Servidor EC2 (Ubuntu 22.04+)
# Frontend + PostgreSQL Client para acesso ao RDS
# ============================================================
# Uso: chmod +x setup-server.sh && sudo ./setup-server.sh
# ============================================================

set -e

echo "=========================================="
echo "  Setup: Frontend EC2 + PostgreSQL Client"
echo "=========================================="

# 1. Atualizar sistema
echo "[1/6] Atualizando sistema..."
apt-get update && apt-get upgrade -y

# 2. Instalar Nginx
echo "[2/6] Instalando Nginx..."
apt-get install -y nginx
systemctl enable nginx

# 3. Instalar Node.js 20
echo "[3/6] Instalando Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# 4. Instalar PostgreSQL Client (para acesso manual ao RDS)
echo "[4/6] Instalando PostgreSQL Client..."
apt-get install -y postgresql-client

echo ""
echo "  PostgreSQL client instalado!"
echo "  Para conectar ao RDS manualmente:"
echo "  psql postgresql://usuario:senha@host-rds:5432/banco"
echo ""

# 5. Configurar Nginx para SPA
echo "[5/6] Configurando Nginx..."
cat > /etc/nginx/sites-available/default << 'NGINX_CONF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    root /var/www/html;
    index index.html;

    server_name _;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;

    # Cache de assets estaticos
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback - redireciona tudo para index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
NGINX_CONF

# 6. Criar diretorio e reiniciar
echo "[6/6] Finalizando..."
mkdir -p /var/www/html
systemctl restart nginx

echo ""
echo "=========================================="
echo "  Setup concluido com sucesso!"
echo "=========================================="
echo ""
echo "  Proximos passos:"
echo ""
echo "  1. Configure SSL com Certbot:"
echo "     apt-get install -y certbot python3-certbot-nginx"
echo "     certbot --nginx -d seu-dominio.com"
echo ""
echo "  2. Configure os secrets no GitHub:"
echo "     - EC2_HOST: IP publico do EC2"
echo "     - EC2_USER: ubuntu (ou seu usuario)"
echo "     - EC2_SSH_KEY: chave SSH privada"
echo "     - VITE_SUPABASE_URL"
echo "     - VITE_SUPABASE_PUBLISHABLE_KEY"
echo "     - VITE_SUPABASE_PROJECT_ID"
echo ""
echo "  3. Teste a conexao com o RDS:"
echo "     psql postgresql://usuario:senha@host-rds:5432/banco"
echo ""
echo "  4. Execute o schema no RDS:"
echo "     psql postgresql://usuario:senha@host-rds:5432/banco -f setup-rds-schema.sql"
echo ""
