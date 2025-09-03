// Workload Analyzer for SLA Engine
// Analyzes user workload for intelligent assignment decisions
export interface WorkloadData {
  userId: string;
  currentTickets: number;
  activeShifts: number;
  averageResolutionTime: number;
  currentCapacity: number; // 0-100%
  score: number; // 0-100, higher is better for assignment
  lastActivity: Date;
  skillRatings: Record<string, number>;
}

export interface WorkloadSummary {
  totalUsers: number;
  averageWorkload: number;
  overloadedUsers: string[];
  availableUsers: string[];
  recommendations: string[];
}

export class WorkloadAnalyzer {
  private workloadData: Map<string, WorkloadData> = new Map();
  private maxTicketsPerUser = 10;
  private maxCapacityThreshold = 80;

  async getCurrentWorkload(userId: string): Promise<WorkloadData> {
    let workload = this.workloadData.get(userId);
    
    if (!workload) {
      // Initialize workload data for new user
      workload = {
        userId,
        currentTickets: 0,
        activeShifts: 0,
        averageResolutionTime: 4.0, // 4 hours default
        currentCapacity: 0,
        score: 100,
        lastActivity: new Date(),
        skillRatings: {},
      };
      this.workloadData.set(userId, workload);
    }
    
    // Update score based on current metrics
    workload.score = this.calculateWorkloadScore(workload);
    
    return workload;
  }

  async getWorkloads(userIds: string[]): Promise<Record<string, WorkloadData>> {
    const workloads: Record<string, WorkloadData> = {};
    
    for (const userId of userIds) {
      workloads[userId] = await this.getCurrentWorkload(userId);
    }
    
    return workloads;
  }

  async updateWorkload(userId: string, updates: Partial<WorkloadData>): Promise<void> {
    const current = await this.getCurrentWorkload(userId);
    
    Object.assign(current, updates, {
      lastActivity: new Date(),
      score: this.calculateWorkloadScore({ ...current, ...updates }),
    });
    
    this.workloadData.set(userId, current);
  }

  async incrementTicketCount(userId: string): Promise<void> {
    const workload = await this.getCurrentWorkload(userId);
    workload.currentTickets += 1;
    workload.currentCapacity = Math.min(100, (workload.currentTickets / this.maxTicketsPerUser) * 100);
    workload.score = this.calculateWorkloadScore(workload);
    workload.lastActivity = new Date();
    
    this.workloadData.set(userId, workload);
  }

  async decrementTicketCount(userId: string): Promise<void> {
    const workload = await this.getCurrentWorkload(userId);
    workload.currentTickets = Math.max(0, workload.currentTickets - 1);
    workload.currentCapacity = Math.min(100, (workload.currentTickets / this.maxTicketsPerUser) * 100);
    workload.score = this.calculateWorkloadScore(workload);
    workload.lastActivity = new Date();
    
    this.workloadData.set(userId, workload);
  }

  async getAvailableUsers(minScore: number = 50): Promise<string[]> {
    const availableUsers: string[] = [];
    
    for (const [userId, workload] of this.workloadData.entries()) {
      if (workload.score >= minScore && workload.currentCapacity < this.maxCapacityThreshold) {
        availableUsers.push(userId);
      }
    }
    
    // Sort by score (highest first)
    return availableUsers.sort((a, b) => {
      const scoreA = this.workloadData.get(a)?.score || 0;
      const scoreB = this.workloadData.get(b)?.score || 0;
      return scoreB - scoreA;
    });
  }

  async getOverloadedUsers(): Promise<string[]> {
    const overloadedUsers: string[] = [];
    
    for (const [userId, workload] of this.workloadData.entries()) {
      if (workload.currentCapacity >= this.maxCapacityThreshold || workload.currentTickets >= this.maxTicketsPerUser) {
        overloadedUsers.push(userId);
      }
    }
    
    return overloadedUsers;
  }

  async getWorkloadSummary(): Promise<WorkloadSummary> {
    const allUsers = Array.from(this.workloadData.keys());
    const totalUsers = allUsers.length;
    
    if (totalUsers === 0) {
      return {
        totalUsers: 0,
        averageWorkload: 0,
        overloadedUsers: [],
        availableUsers: [],
        recommendations: ['No users in the system'],
      };
    }
    
    const totalCapacity = Array.from(this.workloadData.values())
      .reduce((sum, workload) => sum + workload.currentCapacity, 0);
    
    const averageWorkload = totalCapacity / totalUsers;
    const overloadedUsers = await this.getOverloadedUsers();
    const availableUsers = await this.getAvailableUsers();
    
    const recommendations = this.generateRecommendations(averageWorkload, overloadedUsers.length, availableUsers.length);
    
    return {
      totalUsers,
      averageWorkload,
      overloadedUsers,
      availableUsers,
      recommendations,
    };
  }

  async balanceWorkload(): Promise<{
    redistributions: Array<{
      from: string;
      to: string;
      ticketCount: number;
    }>;
    summary: string;
  }> {
    const overloadedUsers = await this.getOverloadedUsers();
    const availableUsers = await this.getAvailableUsers();
    const redistributions: Array<{ from: string; to: string; ticketCount: number }> = [];
    
    for (const overloadedUserId of overloadedUsers) {
      const overloadedWorkload = this.workloadData.get(overloadedUserId);
      if (!overloadedWorkload) continue;
      
      const excessTickets = overloadedWorkload.currentTickets - Math.floor(this.maxTicketsPerUser * 0.8);
      if (excessTickets <= 0) continue;
      
      // Find best candidates for redistribution
      for (const availableUserId of availableUsers) {
        const availableWorkload = this.workloadData.get(availableUserId);
        if (!availableWorkload) continue;
        
        const availableCapacity = this.maxTicketsPerUser - availableWorkload.currentTickets;
        if (availableCapacity <= 0) continue;
        
        const ticketsToRedistribute = Math.min(excessTickets, availableCapacity, 3); // Max 3 tickets per redistribution
        
        if (ticketsToRedistribute > 0) {
          redistributions.push({
            from: overloadedUserId,
            to: availableUserId,
            ticketCount: ticketsToRedistribute,
          });
          
          // Update workload data
          overloadedWorkload.currentTickets -= ticketsToRedistribute;
          availableWorkload.currentTickets += ticketsToRedistribute;
          
          // Recalculate scores and capacity
          overloadedWorkload.currentCapacity = (overloadedWorkload.currentTickets / this.maxTicketsPerUser) * 100;
          availableWorkload.currentCapacity = (availableWorkload.currentTickets / this.maxTicketsPerUser) * 100;
          overloadedWorkload.score = this.calculateWorkloadScore(overloadedWorkload);
          availableWorkload.score = this.calculateWorkloadScore(availableWorkload);
          
          break; // Move to next overloaded user
        }
      }
    }
    
    const summary = redistributions.length > 0 
      ? `Recommended ${redistributions.length} workload redistributions to balance load`
      : 'No redistribution needed - workload is balanced';
    
    return {
      redistributions,
      summary,
    };
  }

  async addSkillRating(userId: string, skill: string, rating: number): Promise<void> {
    const workload = await this.getCurrentWorkload(userId);
    workload.skillRatings[skill] = Math.max(0, Math.min(10, rating)); // 0-10 scale
    workload.score = this.calculateWorkloadScore(workload);
    
    this.workloadData.set(userId, workload);
  }

  async getSkillMatch(userId: string, requiredSkills: string[]): Promise<number> {
    const workload = await this.getCurrentWorkload(userId);
    
    if (requiredSkills.length === 0) return 8; // Default skill match if no specific skills required
    
    let totalRating = 0;
    let matchedSkills = 0;
    
    for (const skill of requiredSkills) {
      const rating = workload.skillRatings[skill];
      if (rating !== undefined) {
        totalRating += rating;
        matchedSkills++;
      }
    }
    
    if (matchedSkills === 0) return 5; // Neutral skill match if no skills matched
    
    return totalRating / matchedSkills; // Average skill rating
  }

  // Private helper methods
  
  private calculateWorkloadScore(workload: WorkloadData): number {
    let score = 100;
    
    // Capacity penalty (more tickets = lower score)
    score -= workload.currentCapacity * 0.5;
    
    // Efficiency bonus (faster resolution = higher score)
    const avgResolutionHours = workload.averageResolutionTime;
    if (avgResolutionHours < 2) score += 10;
    else if (avgResolutionHours < 4) score += 5;
    else if (avgResolutionHours > 8) score -= 10;
    
    // Activity penalty (inactive users get lower scores)
    const hoursSinceActivity = (Date.now() - workload.lastActivity.getTime()) / (1000 * 60 * 60);
    if (hoursSinceActivity > 24) score -= 20;
    else if (hoursSinceActivity > 8) score -= 10;
    
    // Skill bonus (users with more skills get higher scores)
    const skillCount = Object.keys(workload.skillRatings).length;
    score += Math.min(skillCount * 2, 10); // Max 10 point bonus for skills
    
    return Math.max(0, Math.min(100, score));
  }

  private generateRecommendations(
    averageWorkload: number, 
    overloadedCount: number, 
    availableCount: number
  ): string[] {
    const recommendations: string[] = [];
    
    if (overloadedCount > 0) {
      recommendations.push(`${overloadedCount} users are overloaded - consider redistributing work`);
    }
    
    if (averageWorkload > 80) {
      recommendations.push('Overall system workload is high - consider adding more staff');
    } else if (averageWorkload < 30) {
      recommendations.push('Overall system workload is low - capacity available for more work');
    }
    
    if (availableCount === 0) {
      recommendations.push('No users currently available for new assignments');
    } else {
      recommendations.push(`${availableCount} users available for new assignments`);
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Workload distribution is optimal');
    }
    
    return recommendations;
  }

  // Configuration methods
  
  setMaxTicketsPerUser(max: number): void {
    this.maxTicketsPerUser = Math.max(1, max);
  }

  setMaxCapacityThreshold(threshold: number): void {
    this.maxCapacityThreshold = Math.max(0, Math.min(100, threshold));
  }

  getConfiguration(): { maxTicketsPerUser: number; maxCapacityThreshold: number } {
    return {
      maxTicketsPerUser: this.maxTicketsPerUser,
      maxCapacityThreshold: this.maxCapacityThreshold,
    };
  }

  // Data management
  
  clearWorkloadData(userId?: string): void {
    if (userId) {
      this.workloadData.delete(userId);
    } else {
      this.workloadData.clear();
    }
  }

  exportWorkloadData(): Record<string, WorkloadData> {
    const exported: Record<string, WorkloadData> = {};
    for (const [userId, workload] of this.workloadData.entries()) {
      exported[userId] = { ...workload };
    }
    return exported;
  }

  importWorkloadData(data: Record<string, WorkloadData>): void {
    this.workloadData.clear();
    for (const [userId, workload] of Object.entries(data)) {
      this.workloadData.set(userId, workload);
    }
  }
}
