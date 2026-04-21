# ============================================================
#  Portal ArizoRAE — nginx hardened
# ============================================================

FROM nginx:1.27-alpine3.21

# Supprimer la config par défaut et les pages d'exemple
RUN rm -rf /etc/nginx/conf.d/default.conf \
           /usr/share/nginx/html/* \
           /etc/nginx/nginx.conf

# Copier la config hardened
# (context = racine du repo, donc chemins depuis la racine)
COPY docker/portal/nginx.conf /etc/nginx/nginx.conf

# Copier les fichiers statiques
COPY docker/portal/www/ /usr/share/nginx/html/

# Copier le skill pour téléchargement (depuis la racine du repo)
COPY rae-generic.skill /usr/share/nginx/html/downloads/rae-generic.skill

# Ajuster les permissions pour l'utilisateur nginx (101:101)
RUN chown -R nginx:nginx /usr/share/nginx/html \
    && chmod -R 755 /usr/share/nginx/html \
    && chown -R nginx:nginx /var/cache/nginx \
    && chown -R nginx:nginx /var/log/nginx \
    && touch /var/run/nginx.pid \
    && chown nginx:nginx /var/run/nginx.pid

USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:8080/health || exit 1
