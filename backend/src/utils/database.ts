import logger from "./logger";
import { metricsCollector } from "../middleware/metrics";

// Mock database service for development without PostgreSQL
// In production, this would be replaced with actual PostgreSQL implementation
export interface QueryResult {
  rows: any[];
  rowCount: number | null;
}

export interface DatabaseMetric {
  timestamp: number;
  query: string;
  durationMs: number;
  success: boolean;
  error?: string;
}

export class DatabaseService {
  private metrics: DatabaseMetric[] = [];
  private readonly maxMetricsRetention = 1000;

  /**
   * Mock query execution - returns sample data for analytics
   */
  async query(text: string, params?: any[]): Promise<QueryResult> {
    const start = Date.now();

    try {
      // Simulate database delay using a simple timeout
      const startMs = Date.now();
      while (Date.now() - startMs < 10) {
        // Simple busy wait to simulate delay
      }

      const duration = Date.now() - start;
      this.recordMetric(text, duration, true);

      logger.debug("Mock database query executed", {
        query: text.substring(0, 100),
        duration: `${duration}ms`,
        params: params?.length || 0,
      });

      // Return mock data based on query patterns
      if (
        text.includes("user_payments") ||
        text.includes("payments WHERE user_id")
      ) {
        return this.generateMockUserData(params?.[0]);
      } else if (text.includes("COUNT(*) FROM users")) {
        return { rows: [{ total_users: 150 }], rowCount: 1 };
      } else if (text.includes("COUNT(*) FROM meters")) {
        return { rows: [{ total_meters: 450 }], rowCount: 1 };
      } else if (text.includes("COUNT(*) FROM payments WHERE status")) {
        return { rows: [{ total_payments: 2500 }], rowCount: 1 };
      } else if (text.includes("SUM(amount) FROM payments")) {
        return { rows: [{ total_volume: 125000.5 }], rowCount: 1 };
      } else if (text.includes("blockchain_network")) {
        return {
          rows: [
            { blockchain_network: "testnet", count: 2000 },
            { blockchain_network: "mainnet", count: 500 },
          ],
          rowCount: 2,
        };
      } else if (text.includes("meter_type")) {
        return {
          rows: [
            { meter_type: "electricity", count: 200 },
            { meter_type: "water", count: 150 },
            { meter_type: "gas", count: 100 },
          ],
          rowCount: 3,
        };
      } else if (text.includes("status") && text.includes("GROUP BY status")) {
        return {
          rows: [
            { status: "confirmed", count: 2200 },
            { status: "pending", count: 200 },
            { status: "failed", count: 100 },
          ],
          rowCount: 3,
        };
      }

      // Default empty result
      return { rows: [], rowCount: 0 };
    } catch (error) {
      const duration = Date.now() - start;
      this.recordMetric(text, duration, false, error instanceof Error ? error.message : 'Unknown error');

      logger.error("Mock database query failed", {
        query: text.substring(0, 100),
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Record database performance metric
   */
  private recordMetric(query: string, durationMs: number, success: boolean, error?: string) {
    const metric: DatabaseMetric = {
      timestamp: Date.now(),
      query: query.substring(0, 200), // Truncate long queries
      durationMs,
      success,
      error,
    };

    this.metrics.push(metric);

    if (this.metrics.length > this.maxMetricsRetention) {
      this.metrics = this.metrics.slice(-this.maxMetricsRetention);
    }

    // Also record in the general metrics collector
    metricsCollector.recordDatabaseQuery(durationMs, success);
  }

  /**
   * Get database performance metrics
   */
  getMetrics(windowMs: number = 60_000): DatabaseMetric[] {
    const cutoff = Date.now() - windowMs;
    return this.metrics.filter((m) => m.timestamp > cutoff);
  }

  /**
   * Get database performance summary
   */
  getPerformanceSummary(windowMs: number = 60_000): {
    totalQueries: number;
    successfulQueries: number;
    failedQueries: number;
    averageQueryTime: number;
    slowestQuery: number;
    errorRate: number;
  } {
    const recent = this.getMetrics(windowMs);

    if (recent.length === 0) {
      return {
        totalQueries: 0,
        successfulQueries: 0,
        failedQueries: 0,
        averageQueryTime: 0,
        slowestQuery: 0,
        errorRate: 0,
      };
    }

    const successful = recent.filter(m => m.success);
    const failed = recent.filter(m => !m.success);

    return {
      totalQueries: recent.length,
      successfulQueries: successful.length,
      failedQueries: failed.length,
      averageQueryTime: successful.length > 0 ? successful.reduce((sum, m) => sum + m.durationMs, 0) / successful.length : 0,
      slowestQuery: successful.length > 0 ? Math.max(...successful.map(m => m.durationMs)) : 0,
      errorRate: recent.length > 0 ? failed.length / recent.length : 0,
    };
  }

  /**
   * Generate mock user data for analytics
   */
  private generateMockUserData(userId: string): QueryResult {
    const seed = userId.length + userId.charCodeAt(0);
    const totalPayments = Math.max(5, (seed * 3) % 50);
    const totalSpent = Math.round(seed * 123.45 * 100) / 100;
    const avgPayment = Math.round((totalSpent / totalPayments) * 100) / 100;

    // Generate monthly spending data
    const monthlyData = [];
    const currentDate = new Date();
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - i,
        1,
      );
      const monthValue =
        Math.round(avgPayment * (2 + Math.random() * 3) * 100) / 100;
      monthlyData.push({
        period: monthDate.toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        }),
        value: monthValue,
        count: Math.floor(2 + Math.random() * 4),
      });
    }

    return {
      rows: [
        {
          total_payments: totalPayments,
          total_spent: totalSpent,
          avg_payment: avgPayment,
          last_payment_date: new Date(
            Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          payments_this_month: Math.floor(1 + Math.random() * 5),
          payments_this_year: totalPayments,
          monthly_data: monthlyData,
        },
      ],
      rowCount: 1,
    };
  }

  /**
   * Mock transaction support
   */
  async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    // For mock implementation, just execute the callback
    return callback(null);
  }

  /**
   * Mock connection test
   */
  async testConnection(): Promise<boolean> {
    logger.info("Mock database connection test successful");
    return true;
  }

  /**
   * Mock close method
   */
  async close(): Promise<void> {
    logger.info("Mock database connection closed");
  }
}

// Export singleton instance
export const database = new DatabaseService();
