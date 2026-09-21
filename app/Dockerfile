FROM nginx:alpine

WORKDIR /app

COPY . /app

RUN chmod +x /app/entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/app/entrypoint.sh"]