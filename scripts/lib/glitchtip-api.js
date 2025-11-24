/**
 * GlitchTip API Client Library
 *
 * Reusable client for interacting with GlitchTip API (Sentry-compatible)
 *
 * Usage:
 *   const GlitchTipAPI = require('./lib/glitchtip-api');
 *   const client = new GlitchTipAPI(baseURL, apiToken);
 *   const orgs = await client.getOrganizations();
 *   const issues = await client.getIssues('admin-ai', { limit: 10 });
 *
 * @see https://glitchtip.com/documentation/api
 */

const axios = require('axios');

class GlitchTipAPI {
  /**
   * Initialize GlitchTip API client
   *
   * @param {string} baseURL - GlitchTip base URL (e.g., 'http://localhost:8080')
   * @param {string} apiToken - API authentication token
   * @param {object} options - Additional options (timeout, retries)
   */
  constructor(baseURL, apiToken, options = {}) {
    if (!baseURL) {
      throw new Error('baseURL is required');
    }
    if (!apiToken) {
      throw new Error('apiToken is required');
    }

    this.baseURL = baseURL;
    this.apiToken = apiToken;
    this.timeout = options.timeout || 30000; // 30s default
    this.maxRetries = options.maxRetries || 3;

    // Create axios instance with default config
    this.client = axios.create({
      baseURL: `${baseURL}/api/0`,
      timeout: this.timeout,
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      error => this._handleError(error)
    );
  }

  /**
   * Handle API errors with retries for transient failures
   *
   * @private
   */
  async _handleError(error) {
    if (error.response) {
      // HTTP error response (4xx, 5xx)
      const { status, data } = error.response;

      // Don't retry 4xx errors (client errors)
      if (status >= 400 && status < 500) {
        throw new Error(`HTTP ${status}: ${data.detail || data.message || 'Client error'}`);
      }

      // Retry 5xx errors (server errors)
      if (status >= 500 && error.config && !error.config.__retryCount) {
        error.config.__retryCount = 0;
      }

      if (error.config.__retryCount < this.maxRetries) {
        error.config.__retryCount++;
        const delay = Math.pow(2, error.config.__retryCount) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.client.request(error.config);
      }

      throw new Error(`HTTP ${status}: ${data.detail || data.message || 'Server error'}`);
    } else if (error.request) {
      // No response received (network error)
      throw new Error(`Network error: ${error.message}`);
    } else {
      // Other errors
      throw new Error(`Request error: ${error.message}`);
    }
  }

  /**
   * Get all organizations
   *
   * @returns {Promise<Array>} List of organizations
   */
  async getOrganizations() {
    try {
      const { data } = await this.client.get('/organizations/');
      return data;
    } catch (error) {
      throw new Error(`Failed to get organizations: ${error.message}`);
    }
  }

  /**
   * Get issues for an organization
   *
   * @param {string} orgSlug - Organization slug
   * @param {object} params - Query parameters
   * @param {number} params.limit - Max results (default: 25)
   * @param {string} params.query - Search query (e.g., 'is:unresolved')
   * @param {string} params.statsPeriod - Time period (e.g., '24h', '7d', '30d')
   * @param {string} params.sort - Sort field (e.g., 'date', 'freq', 'new')
   * @returns {Promise<Array>} List of issues
   */
  async getIssues(orgSlug, params = {}) {
    try {
      // Clean params - remove undefined values
      const cleanParams = Object.fromEntries(
        Object.entries(params).filter(([_, v]) => v !== undefined && v !== null)
      );

      const { data } = await this.client.get(`/organizations/${orgSlug}/issues/`, {
        params: cleanParams,
        timeout: 60000 // Increase timeout for large responses
      });
      return data;
    } catch (error) {
      throw new Error(`Failed to get issues: ${error.message}`);
    }
  }

  /**
   * Search issues with query string
   *
   * @param {string} orgSlug - Organization slug
   * @param {string} query - Search query (e.g., 'is:unresolved level:error')
   * @param {number} limit - Max results (default: 10)
   * @param {string} sort - Sort field (default: 'date')
   * @returns {Promise<Array>} Matching issues
   */
  async searchIssues(orgSlug, query, limit = 10, sort = 'date') {
    return this.getIssues(orgSlug, { query, limit, sort });
  }

  /**
   * Get detailed information for a specific issue
   *
   * @param {string} orgSlug - Organization slug
   * @param {string|number} issueId - Issue ID
   * @returns {Promise<object>} Issue details with full metadata
   */
  async getIssue(orgSlug, issueId) {
    try {
      const { data } = await this.client.get(`/organizations/${orgSlug}/issues/${issueId}/`);
      return data;
    } catch (error) {
      throw new Error(`Failed to get issue ${issueId}: ${error.message}`);
    }
  }

  /**
   * Add a comment to an issue
   *
   * @param {string} orgSlug - Organization slug
   * @param {string|number} issueId - Issue ID
   * @param {string} text - Comment text (supports markdown)
   * @returns {Promise<object>} Created comment
   */
  async addComment(orgSlug, issueId, text) {
    try {
      const { data } = await this.client.post(
        `/organizations/${orgSlug}/issues/${issueId}/comments/`,
        { data: { text } }
      );
      return data;
    } catch (error) {
      throw new Error(`Failed to add comment to issue ${issueId}: ${error.message}`);
    }
  }

  /**
   * Resolve an issue
   *
   * @param {string} orgSlug - Organization slug
   * @param {string|number} issueId - Issue ID
   * @returns {Promise<object>} Updated issue
   */
  async resolveIssue(orgSlug, issueId) {
    try {
      const { data } = await this.client.put(
        `/organizations/${orgSlug}/issues/${issueId}/`,
        { status: 'resolved' }
      );
      return data;
    } catch (error) {
      throw new Error(`Failed to resolve issue ${issueId}: ${error.message}`);
    }
  }

  /**
   * Get statistics for organization
   *
   * @param {string} orgSlug - Organization slug
   * @param {string} since - Time period (e.g., '24h', '7d', '30d')
   * @returns {Promise<object>} Statistics data
   */
  async getStats(orgSlug, since = '24h') {
    try {
      const { data } = await this.client.get(`/organizations/${orgSlug}/stats/`, {
        params: { statsPeriod: since }
      });
      return data;
    } catch (error) {
      throw new Error(`Failed to get stats: ${error.message}`);
    }
  }

  /**
   * Get events for a specific issue
   *
   * @param {string} orgSlug - Organization slug
   * @param {string|number} issueId - Issue ID
   * @param {number} limit - Max results (default: 10)
   * @returns {Promise<Array>} List of events
   */
  async getIssueEvents(orgSlug, issueId, limit = 10) {
    try {
      const { data } = await this.client.get(
        `/organizations/${orgSlug}/issues/${issueId}/events/`,
        { params: { limit } }
      );
      return data;
    } catch (error) {
      throw new Error(`Failed to get events for issue ${issueId}: ${error.message}`);
    }
  }

  /**
   * Get projects for an organization
   *
   * @param {string} orgSlug - Organization slug
   * @returns {Promise<Array>} List of projects
   */
  async getProjects(orgSlug) {
    try {
      const { data } = await this.client.get(`/organizations/${orgSlug}/projects/`);
      return data;
    } catch (error) {
      throw new Error(`Failed to get projects: ${error.message}`);
    }
  }

  /**
   * Bulk update issues (resolve, archive, etc.)
   *
   * @param {string} orgSlug - Organization slug
   * @param {Array<string|number>} issueIds - Array of issue IDs
   * @param {object} update - Update data (e.g., { status: 'resolved' })
   * @returns {Promise<object>} Update result
   */
  async bulkUpdateIssues(orgSlug, issueIds, update) {
    try {
      const { data } = await this.client.put(
        `/organizations/${orgSlug}/issues/`,
        {
          itemIds: issueIds.map(String),
          ...update
        }
      );
      return data;
    } catch (error) {
      throw new Error(`Failed to bulk update issues: ${error.message}`);
    }
  }

  /**
   * Get team members for an organization
   *
   * @param {string} orgSlug - Organization slug
   * @returns {Promise<Array>} List of team members
   */
  async getTeamMembers(orgSlug) {
    try {
      const { data } = await this.client.get(`/organizations/${orgSlug}/members/`);
      return data;
    } catch (error) {
      throw new Error(`Failed to get team members: ${error.message}`);
    }
  }
}

module.exports = GlitchTipAPI;
