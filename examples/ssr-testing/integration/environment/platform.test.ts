/**
 * Platform Integration Tests
 * 
 * Tests that validate SSR functionality across different platforms.
 */

import React from 'react';
import { PlatformTester, PlatformConfig } from './platform-tests';
import { SimpleComponent } from '../../fixtures/components';

describe('Platform Integration Tests', () => {
  it('should test component rendering in Next.js on Linux', async () => {
    const platform: PlatformConfig = {
      name: 'Vercel Next.js',
      environment: {
        nodeVersion: '18.x',
        os: 'linux',
        memory: 'medium',
        filesystem: 'networked',
      },
      framework: {
        server: 'next',
        client: 'react',
        bundler: 'webpack',
      },
    };
    
    const element = React.createElement(SimpleComponent, { 
      text: 'Next.js Platform Test'
    });
    
    const result = await PlatformTester.testPlatform(platform, element);
    
    expect(result.renderingSuccess).toBe(true);
    expect(result.hydrationSuccess).toBe(true);
    expect(result.errors).toHaveLength(0);
    
    // Verify performance metrics exist
    expect(result.performance.serverRenderTime).toBeGreaterThan(0);
    expect(result.performance.clientHydrationTime).toBeGreaterThan(0);
    expect(result.performance.bundleSizes.client).toBeGreaterThan(0);
    expect(result.performance.bundleSizes.server).toBeGreaterThan(0);
  });
  
  it('should test component rendering in Remix on Windows', async () => {
    const platform: PlatformConfig = {
      name: 'Netlify Remix',
      environment: {
        nodeVersion: '16.x',
        os: 'windows',
        memory: 'high',
        filesystem: 'disk',
      },
      framework: {
        server: 'remix',
        client: 'react',
        bundler: 'vite',
      },
    };
    
    const element = React.createElement(SimpleComponent, { 
      text: 'Remix Platform Test'
    });
    
    const result = await PlatformTester.testPlatform(platform, element);
    
    expect(result.renderingSuccess).toBe(true);
    expect(result.hydrationSuccess).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
  
  it('should benchmark different platforms for comparison', async () => {
    const element = React.createElement(SimpleComponent, { 
      text: 'Platform Benchmark Test'
    });
    
    // Define several platform configurations
    const platforms: PlatformConfig[] = [
      {
        name: 'Vercel Next.js',
        environment: {
          nodeVersion: '18.x',
          os: 'linux',
          memory: 'medium',
          filesystem: 'networked',
        },
        framework: {
          server: 'next',
          client: 'react',
          bundler: 'webpack',
        },
      },
      {
        name: 'AWS Lambda Next.js',
        environment: {
          nodeVersion: '18.x',
          os: 'linux',
          memory: 'low',
          filesystem: 'disk',
        },
        framework: {
          server: 'next',
          client: 'react',
          bundler: 'webpack',
        },
      },
      {
        name: 'Netlify Remix',
        environment: {
          nodeVersion: '16.x',
          os: 'linux',
          memory: 'medium',
          filesystem: 'disk',
        },
        framework: {
          server: 'remix',
          client: 'react',
          bundler: 'vite',
        },
      },
      {
        name: 'Cloudflare Pages',
        environment: {
          nodeVersion: '20.x',
          os: 'linux',
          memory: 'low',
          filesystem: 'memory',
        },
        framework: {
          server: 'express',
          client: 'react',
          bundler: 'rollup',
        },
      },
    ];
    
    // Test on each platform
    const results = await Promise.all(
      platforms.map(platform => PlatformTester.testPlatform(platform, element))
    );
    
    // Validate all tests passed
    for (const result of results) {
      expect(result.renderingSuccess).toBe(true);
      expect(result.hydrationSuccess).toBe(true);
      expect(result.errors).toHaveLength(0);
    }
    
    // Compare performance metrics
    console.log('Platform Benchmark Results:');
    results.forEach(result => {
      console.log(`${result.platform.name}:`);
      console.log(`- Server Render Time: ${result.performance.serverRenderTime}ms`);
      console.log(`- Client Hydration Time: ${result.performance.clientHydrationTime}ms`);
      console.log(`- Total Bundle Size: ${result.performance.bundleSizes.total} bytes`);
    });
    
    // Find fastest platform for server rendering
    const fastestServerRendering = results.reduce((fastest, current) => 
      current.performance.serverRenderTime < fastest.performance.serverRenderTime ? current : fastest
    );
    
    // Find fastest platform for client hydration
    const fastestClientHydration = results.reduce((fastest, current) => 
      current.performance.clientHydrationTime < fastest.performance.clientHydrationTime ? current : fastest
    );
    
    // Find smallest bundle size
    const smallestBundle = results.reduce((smallest, current) => 
      current.performance.bundleSizes.total < smallest.performance.bundleSizes.total ? current : smallest
    );
    
    console.log('\nBest Performers:');
    console.log(`- Fastest Server Rendering: ${fastestServerRendering.platform.name} (${fastestServerRendering.performance.serverRenderTime}ms)`);
    console.log(`- Fastest Client Hydration: ${fastestClientHydration.platform.name} (${fastestClientHydration.performance.clientHydrationTime}ms)`);
    console.log(`- Smallest Bundle Size: ${smallestBundle.platform.name} (${smallestBundle.performance.bundleSizes.total} bytes)`);
  });
});