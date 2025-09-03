import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import * as nodemailer from 'nodemailer';
import * as ical from 'ical-generator';

// Types and interfaces
export interface Task {
  id: string;
  title: string;
  description: string;
  estimatedDuration: number; // in minutes
  priority: 'low' | 'medium' | 'high' | 'urgent';
  skillsRequired: string[];
  dependencies: string[];
  assignee?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  deadline?: Date;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
}

export interface Resource {
  id: string;
  name: string;
  type: 'employee' | 'equipment' | 'vehicle';
  skills: string[];
  availability: {
    start: Date;
    end: Date;
  }[];
  capacity: number;
  location?: {
    latitude: number;
    longitude: number;
  };
  hourlyRate?: number;
}

export interface Schedule {
  id: string;
  taskId: string;
  resourceId: string;
  startTime: Date;
  endTime: Date;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  estimatedCost: number;
  actualCost?: number;
}

export interface OptimizationConstraints {
  maxWorkingHours: number;
  breakDuration: number;
  travelTimeMultiplier: number;
  overtimeCostMultiplier: number;
  priorityWeights: {
    urgent: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface OptimizationResult {
  schedule: Schedule[];
  totalCost: number;
  completionTime: Date;
  resourceUtilization: { [resourceId: string]: number };
  score: number;
  algorithm: string;
  executionTime: number;
}

// Individual for genetic algorithm
interface Individual {
  genes: number[]; // Task-resource assignments
  fitness: number;
}

// Genetic Algorithm Implementation
class GeneticAlgorithm {
  private populationSize: number = 100;
  private generations: number = 500;
  private mutationRate: number = 0.01;
  private crossoverRate: number = 0.8;
  private eliteSize: number = 20;

  constructor(
    private tasks: Task[],
    private resources: Resource[],
    private constraints: OptimizationConstraints
  ) {}

  async optimize(): Promise<OptimizationResult> {
    const startTime = Date.now();
    
    let population = this.initializePopulation();
    
    for (let gen = 0; gen < this.generations; gen++) {
      // Evaluate fitness
      population.forEach(individual => {
        individual.fitness = this.calculateFitness(individual);
      });
      
      // Sort by fitness (higher is better)
      population.sort((a, b) => b.fitness - a.fitness);
      
      // Create new population
      const newPopulation: Individual[] = [];
      
      // Elite selection
      for (let i = 0; i < this.eliteSize; i++) {
        newPopulation.push({ ...population[i] });
      }
      
      // Generate offspring
      while (newPopulation.length < this.populationSize) {
        const parent1 = this.tournamentSelection(population);
        const parent2 = this.tournamentSelection(population);
        
        let offspring1, offspring2;
        if (Math.random() < this.crossoverRate) {
          [offspring1, offspring2] = this.crossover(parent1, parent2);
        } else {
          offspring1 = { ...parent1 };
          offspring2 = { ...parent2 };
        }
        
        this.mutate(offspring1);
        this.mutate(offspring2);
        
        newPopulation.push(offspring1);
        if (newPopulation.length < this.populationSize) {
          newPopulation.push(offspring2);
        }
      }
      
      population = newPopulation;
    }
    
    // Get best solution
    population.forEach(individual => {
      individual.fitness = this.calculateFitness(individual);
    });
    population.sort((a, b) => b.fitness - a.fitness);
    
    const bestIndividual = population[0];
    const schedule = this.convertToSchedule(bestIndividual);
    
    return {
      schedule,
      totalCost: this.calculateTotalCost(schedule),
      completionTime: this.calculateCompletionTime(schedule),
      resourceUtilization: this.calculateResourceUtilization(schedule),
      score: bestIndividual.fitness,
      algorithm: 'genetic',
      executionTime: Date.now() - startTime
    };
  }

  private initializePopulation(): Individual[] {
    const population: Individual[] = [];
    
    for (let i = 0; i < this.populationSize; i++) {
      const genes = this.tasks.map(() => Math.floor(Math.random() * this.resources.length));
      population.push({ genes, fitness: 0 });
    }
    
    return population;
  }

  private calculateFitness(individual: Individual): number {
    const schedule = this.convertToSchedule(individual);
    const totalCost = this.calculateTotalCost(schedule);
    const completionTime = this.calculateCompletionTime(schedule);
    const resourceUtilization = this.calculateResourceUtilization(schedule);
    
    // Multi-objective fitness function
    const costScore = 1 / (1 + totalCost / 1000); // Minimize cost
    const timeScore = 1 / (1 + (completionTime.getTime() - Date.now()) / (1000 * 60 * 60 * 24)); // Minimize time
    const utilizationScore = Object.values(resourceUtilization).reduce((sum, util) => sum + util, 0) / this.resources.length;
    
    return (costScore * 0.4 + timeScore * 0.4 + utilizationScore * 0.2) * 1000;
  }

  private tournamentSelection(population: Individual[]): Individual {
    const tournamentSize = 5;
    let best = population[Math.floor(Math.random() * population.length)];
    
    for (let i = 1; i < tournamentSize; i++) {
      const competitor = population[Math.floor(Math.random() * population.length)];
      if (competitor.fitness > best.fitness) {
        best = competitor;
      }
    }
    
    return best;
  }

  private crossover(parent1: Individual, parent2: Individual): [Individual, Individual] {
    const crossoverPoint = Math.floor(Math.random() * this.tasks.length);
    
    const offspring1: Individual = {
      genes: [...parent1.genes.slice(0, crossoverPoint), ...parent2.genes.slice(crossoverPoint)],
      fitness: 0
    };
    
    const offspring2: Individual = {
      genes: [...parent2.genes.slice(0, crossoverPoint), ...parent1.genes.slice(crossoverPoint)],
      fitness: 0
    };
    
    return [offspring1, offspring2];
  }

  private mutate(individual: Individual): void {
    for (let i = 0; i < individual.genes.length; i++) {
      if (Math.random() < this.mutationRate) {
        individual.genes[i] = Math.floor(Math.random() * this.resources.length);
      }
    }
  }

  private convertToSchedule(individual: Individual): Schedule[] {
    const schedule: Schedule[] = [];
    const resourceSchedules: { [resourceId: string]: Date } = {};
    
    // Initialize resource availability
    this.resources.forEach(resource => {
      resourceSchedules[resource.id] = new Date();
    });
    
    this.tasks.forEach((task, index) => {
      const resourceIndex = individual.genes[index];
      const resource = this.resources[resourceIndex];
      
      if (resource) {
        const startTime = new Date(resourceSchedules[resource.id]);
        const endTime = new Date(startTime.getTime() + task.estimatedDuration * 60000);
        
        schedule.push({
          id: `schedule_${task.id}_${resource.id}`,
          taskId: task.id,
          resourceId: resource.id,
          startTime,
          endTime,
          status: 'scheduled',
          estimatedCost: (task.estimatedDuration / 60) * (resource.hourlyRate || 50)
        });
        
        resourceSchedules[resource.id] = endTime;
      }
    });
    
    return schedule;
  }

  private calculateTotalCost(schedule: Schedule[]): number {
    return schedule.reduce((total, item) => total + item.estimatedCost, 0);
  }

  private calculateCompletionTime(schedule: Schedule[]): Date {
    if (schedule.length === 0) return new Date();
    return new Date(Math.max(...schedule.map(item => item.endTime.getTime())));
  }

  private calculateResourceUtilization(schedule: Schedule[]): { [resourceId: string]: number } {
    const utilization: { [resourceId: string]: number } = {};
    
    this.resources.forEach(resource => {
      const resourceSchedules = schedule.filter(item => item.resourceId === resource.id);
      const totalWorkTime = resourceSchedules.reduce((total, item) => 
        total + (item.endTime.getTime() - item.startTime.getTime()), 0
      );
      utilization[resource.id] = Math.min(totalWorkTime / (8 * 60 * 60 * 1000), 1); // 8 hours max
    });
    
    return utilization;
  }
}

// Simulated Annealing Implementation
class SimulatedAnnealing {
  private initialTemperature: number = 1000;
  private coolingRate: number = 0.95;
  private minTemperature: number = 1;
  private maxIterations: number = 10000;

  constructor(
    private tasks: Task[],
    private resources: Resource[],
    private constraints: OptimizationConstraints
  ) {}

  async optimize(): Promise<OptimizationResult> {
    const startTime = Date.now();
    
    let currentSolution = this.generateRandomSolution();
    let currentFitness = this.calculateFitness(currentSolution);
    
    let bestSolution = [...currentSolution];
    let bestFitness = currentFitness;
    
    let temperature = this.initialTemperature;
    let iteration = 0;
    
    while (temperature > this.minTemperature && iteration < this.maxIterations) {
      const newSolution = this.generateNeighborSolution(currentSolution);
      const newFitness = this.calculateFitness(newSolution);
      
      if (newFitness > currentFitness || 
          Math.random() < Math.exp((newFitness - currentFitness) / temperature)) {
        currentSolution = newSolution;
        currentFitness = newFitness;
        
        if (newFitness > bestFitness) {
          bestSolution = [...newSolution];
          bestFitness = newFitness;
        }
      }
      
      temperature *= this.coolingRate;
      iteration++;
    }
    
    const schedule = this.convertToSchedule(bestSolution);
    
    return {
      schedule,
      totalCost: this.calculateTotalCost(schedule),
      completionTime: this.calculateCompletionTime(schedule),
      resourceUtilization: this.calculateResourceUtilization(schedule),
      score: bestFitness,
      algorithm: 'simulated_annealing',
      executionTime: Date.now() - startTime
    };
  }

  private generateRandomSolution(): number[] {
    return this.tasks.map(() => Math.floor(Math.random() * this.resources.length));
  }

  private generateNeighborSolution(solution: number[]): number[] {
    const newSolution = [...solution];
    const randomIndex = Math.floor(Math.random() * newSolution.length);
    newSolution[randomIndex] = Math.floor(Math.random() * this.resources.length);
    return newSolution;
  }

  private calculateFitness(solution: number[]): number {
    const schedule = this.convertToSchedule(solution);
    const totalCost = this.calculateTotalCost(schedule);
    const completionTime = this.calculateCompletionTime(schedule);
    
    // Fitness function (higher is better)
    const costScore = 1 / (1 + totalCost / 1000);
    const timeScore = 1 / (1 + (completionTime.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    
    return (costScore + timeScore) * 1000;
  }

  private convertToSchedule(solution: number[]): Schedule[] {
    const schedule: Schedule[] = [];
    const resourceSchedules: { [resourceId: string]: Date } = {};
    
    this.resources.forEach(resource => {
      resourceSchedules[resource.id] = new Date();
    });
    
    this.tasks.forEach((task, index) => {
      const resourceIndex = solution[index];
      const resource = this.resources[resourceIndex];
      
      if (resource) {
        const startTime = new Date(resourceSchedules[resource.id]);
        const endTime = new Date(startTime.getTime() + task.estimatedDuration * 60000);
        
        schedule.push({
          id: `schedule_${task.id}_${resource.id}`,
          taskId: task.id,
          resourceId: resource.id,
          startTime,
          endTime,
          status: 'scheduled',
          estimatedCost: (task.estimatedDuration / 60) * (resource.hourlyRate || 50)
        });
        
        resourceSchedules[resource.id] = endTime;
      }
    });
    
    return schedule;
  }

  private calculateTotalCost(schedule: Schedule[]): number {
    return schedule.reduce((total, item) => total + item.estimatedCost, 0);
  }

  private calculateCompletionTime(schedule: Schedule[]): Date {
    if (schedule.length === 0) return new Date();
    return new Date(Math.max(...schedule.map(item => item.endTime.getTime())));
  }

  private calculateResourceUtilization(schedule: Schedule[]): { [resourceId: string]: number } {
    const utilization: { [resourceId: string]: number } = {};
    
    this.resources.forEach(resource => {
      const resourceSchedules = schedule.filter(item => item.resourceId === resource.id);
      const totalWorkTime = resourceSchedules.reduce((total, item) => 
        total + (item.endTime.getTime() - item.startTime.getTime()), 0
      );
      utilization[resource.id] = Math.min(totalWorkTime / (8 * 60 * 60 * 1000), 1);
    });
    
    return utilization;
  }
}

// Main Planner Service
export class PlannerService {
  private constraints: OptimizationConstraints = {
    maxWorkingHours: 8,
    breakDuration: 60,
    travelTimeMultiplier: 1.5,
    overtimeCostMultiplier: 1.5,
    priorityWeights: {
      urgent: 4,
      high: 3,
      medium: 2,
      low: 1
    }
  };

  async optimizeSchedule(
    tasks: Task[],
    resources: Resource[],
    algorithm: 'genetic' | 'simulated_annealing' | 'hybrid' = 'hybrid',
    constraints?: Partial<OptimizationConstraints>
  ): Promise<OptimizationResult> {
    const mergedConstraints = { ...this.constraints, ...constraints };
    
    if (algorithm === 'genetic') {
      const ga = new GeneticAlgorithm(tasks, resources, mergedConstraints);
      return await ga.optimize();
    } else if (algorithm === 'simulated_annealing') {
      const sa = new SimulatedAnnealing(tasks, resources, mergedConstraints);
      return await sa.optimize();
    } else {
      // Hybrid approach - run both and return the better result
      const ga = new GeneticAlgorithm(tasks, resources, mergedConstraints);
      const sa = new SimulatedAnnealing(tasks, resources, mergedConstraints);
      
      const [gaResult, saResult] = await Promise.all([
        ga.optimize(),
        sa.optimize()
      ]);
      
      return gaResult.score > saResult.score ? gaResult : saResult;
    }
  }

  async getScheduleRecommendations(userId: string): Promise<any> {
    // Mock implementation for schedule recommendations
    return {
      recommendations: [
        {
          type: 'workload_balance',
          message: 'Consider redistributing tasks to balance workload',
          priority: 'medium'
        },
        {
          type: 'deadline_warning',
          message: 'Task #123 may miss deadline with current allocation',
          priority: 'high'
        }
      ]
    };
  }

  async analyzeResourceUtilization(timeRange: { start: Date; end: Date }): Promise<any> {
    // Mock implementation for resource utilization analysis
    return {
      period: timeRange,
      utilizationByResource: {},
      averageUtilization: 0.75,
      recommendations: []
    };
  }
}

// Express route handlers
export async function createSchedule(req: Request, res: Response) {
  try {
    const { tasks, resources, algorithm, constraints } = req.body;
    
    const plannerService = new PlannerService();
    const result = await plannerService.optimizeSchedule(tasks, resources, algorithm, constraints);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getOptimizedSchedule(req: Request, res: Response) {
  try {
    const { tasks, resources, algorithm = 'hybrid' } = req.body;
    
    const plannerService = new PlannerService();
    const result = await plannerService.optimizeSchedule(tasks, resources, algorithm);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getScheduleRecommendations(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    
    const plannerService = new PlannerService();
    const recommendations = await plannerService.getScheduleRecommendations(userId);
    
    res.json({
      success: true,
      data: recommendations
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function analyzeResourceUtilization(req: Request, res: Response) {
  try {
    const { startDate, endDate } = req.query;
    
    const timeRange = {
      start: new Date(startDate as string),
      end: new Date(endDate as string)
    };
    
    const plannerService = new PlannerService();
    const analysis = await plannerService.analyzeResourceUtilization(timeRange);
    
    res.json({
      success: true,
      data: analysis
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// Additional exports for route compatibility
export async function scheduleWorkOrder(req: Request, res: Response) {
  return createSchedule(req, res);
}

export async function optimizeScheduleForPeriod(req: Request, res: Response) {
  return getOptimizedSchedule(req, res);
}

export async function getSchedulingMetrics(req: Request, res: Response) {
  try {
    const metrics = {
      totalScheduledTasks: 125,
      averageCompletionTime: 4.2,
      resourceUtilization: 0.78,
      onTimeDelivery: 0.92
    };
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function analyzeResourceOptimization(req: Request, res: Response) {
  return analyzeResourceUtilization(req, res);
}

// Advanced Scheduling Engine class export
export class AdvancedSchedulingEngine extends PlannerService {
  constructor() {
    super();
  }
}

export default PlannerService;
