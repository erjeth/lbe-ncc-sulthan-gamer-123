FROM nginx:alpine

WORKDIR /app

COPY . /app

RUN chmod +x /app/app/entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/app/app/entrypoint.sh"]