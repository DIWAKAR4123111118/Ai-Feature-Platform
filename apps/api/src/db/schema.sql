-- AI Feature Platform Database Schema

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  github_username VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE repositories (
  id SERIAL PRIMARY KEY,
  github_url VARCHAR(500) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  stars INTEGER DEFAULT 0,
  language VARCHAR(100),
  security_score INTEGER,
  quality_score INTEGER,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE features (
  id SERIAL PRIMARY KEY,
  repo_id INTEGER REFERENCES repositories(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  version VARCHAR(50),
  description TEXT,
  status VARCHAR(50) DEFAULT 'discovered',
  approved BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE security_scans (
  id SERIAL PRIMARY KEY,
  repo_id INTEGER REFERENCES repositories(id) ON DELETE CASCADE,
  scan_type VARCHAR(100) NOT NULL,
  result JSONB,
  vulnerabilities_count INTEGER DEFAULT 0,
  passed BOOLEAN DEFAULT false,
  scanned_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_repos_status ON repositories(status);
CREATE INDEX idx_features_approved ON features(approved);
CREATE INDEX idx_users_email ON users(email);