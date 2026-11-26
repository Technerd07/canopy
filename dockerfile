FROM nginx:alpine

# Copy the static web app into Nginx's document root.
COPY web/ /usr/share/nginx/html/


