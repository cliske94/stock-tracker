Spring Boot web app (Gradle) that returns the top-5 Nasdaq stocks at `/`.

Build & run:

```bash
# install JDK + gradle if needed
sudo apt-get update && sudo apt-get install -y openjdk-17-jdk gradle
# from project folder
cd spring_hello_world
gradle run --no-daemon
```

The app listens on port 8080 by default. Visit http://localhost:8080
