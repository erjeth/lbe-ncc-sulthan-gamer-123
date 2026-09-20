FROM nginx:alpine

WORKDIR /app

COPY . /app

RUN chmod +x /app/docker/entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/app/docker/entrypoint.sh"]