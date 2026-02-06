FROM eclipse-temurin:21-jdk-jammy
WORKDIR /app
COPY build/libs/spring_hello_world-0.1.0.jar app.jar
ENV LOG_PATH=/var/log
EXPOSE 8080
ENTRYPOINT ["java","-jar","/app/app.jar"]
