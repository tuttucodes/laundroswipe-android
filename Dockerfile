FROM node:20-slim

WORKDIR /app

# Install Supabase CLI binary
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/* && \
    curl -fsSL https://github.com/supabase/cli/releases/download/v1.188.7/supabase_1.188.7_linux_amd64.tar.gz | tar xz -C /usr/local/bin && \
    chmod +x /usr/local/bin/supabase

# Copy package files
COPY package.json package-lock.json ./

# Install project dependencies
RUN npm ci

# Copy project files
COPY . .

# Default: deploy the push function
ENTRYPOINT ["supabase"]
CMD ["functions", "deploy", "push"]
