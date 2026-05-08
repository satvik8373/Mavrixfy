#!/usr/bin/env node

/**
 * Check if trending playlist is accessible and ready for frontend
 */

import axios from 'axios';

const API_URL = process.env.API_URL || 'https://spotify-api-drab.vercel.app';

async function checkTrendingEndpoint() {
  console.log('\n=== Checking Trending Playlist Endpoint ===\n');
  
  try {
    console.log(`→ Testing: ${API_URL}/api/playlists/trending`);
    
    const response = await axios.get(`${API_URL}/api/playlists/trending`, {
      timeout: 5000
    });
    
    if (response.data && response.data.success && response.data.data) {
      const playlist = response.data.data;
      
      console.log('✅ Backend API is working!\n');
      console.log(`Playlist ID: ${playlist.id}`);
      console.log(`Playlist Name: ${playlist.name}`);
      console.log(`Song Count: ${playlist.songCount}`);
      console.log(`Type: ${playlist.type}`);
      console.log(`Language: ${playlist.language}`);
      
      if (playlist.songs && playlist.songs.length > 0) {
        console.log(`\nFirst 5 songs:`);
        playlist.songs.slice(0, 5).forEach((song, i) => {
          console.log(`  ${i + 1}. ${song.title} - ${song.artist} (${song.source})`);
        });
      }
      
      console.log('\n✅ Trending playlist is ready for frontend!');
      console.log('\n📝 Next Steps:');
      console.log('1. Make sure frontend is running');
      console.log('2. Open browser DevTools (F12)');
      console.log('3. Run this in Console:');
      console.log('   Object.keys(localStorage).filter(k => k.startsWith("jiosaavn-")).forEach(k => localStorage.removeItem(k)); location.reload();');
      console.log('4. Check the "Trending Now" section on home page');
      console.log('\n🎉 You should see "🔥 Trending Now - Mavrixfy" as the FIRST playlist!');
      
      return true;
    } else {
      console.log('❌ Backend returned unexpected response format');
      console.log('Response:', JSON.stringify(response.data, null, 2));
      return false;
    }
  } catch (error) {
    console.log('❌ Failed to fetch trending playlist');
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n⚠️  Backend is not running!');
      console.log('Start it with: npm run dev');
    } else if (error.response) {
      console.log(`\nHTTP ${error.response.status}: ${error.response.statusText}`);
      console.log('Response:', error.response.data);
    } else {
      console.log(`\nError: ${error.message}`);
    }
    
    return false;
  }
}

async function checkCronJobStatus() {
  console.log('\n=== Checking Cron Job Status ===\n');
  
  try {
    // Check if we can import the trending job
    const trendingJobModule = await import('./src/cron/trendingJob.js');
    const trendingJob = trendingJobModule.default || trendingJobModule;
    
    console.log('✅ Cron job module found');
    
    // Try to get cached trending
    const trending = await trendingJob.getCachedTrending(50);
    
    if (trending && trending.length > 0) {
      console.log(`✅ Trending cache has ${trending.length} songs`);
      
      // Show sources
      const sources = {};
      trending.forEach(song => {
        sources[song.source] = (sources[song.source] || 0) + 1;
      });
      
      console.log('\nSongs by source:');
      Object.entries(sources).forEach(([source, count]) => {
        console.log(`  ${source}: ${count} songs`);
      });
      
      return true;
    } else {
      console.log('⚠️  No trending songs in cache');
      console.log('Run: node quick-update.js');
      return false;
    }
  } catch (error) {
    console.log('❌ Failed to check cron job status');
    console.log(`Error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  Mavrixfy Trending Playlist - Frontend Check          ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  
  const cronOk = await checkCronJobStatus();
  const apiOk = await checkTrendingEndpoint();
  
  console.log('\n=== Summary ===\n');
  console.log(`Cron Job: ${cronOk ? '✅ Working' : '❌ Not Working'}`);
  console.log(`Backend API: ${apiOk ? '✅ Working' : '❌ Not Working'}`);
  
  if (cronOk && apiOk) {
    console.log('\n🎉 Everything is ready!');
    console.log('Just clear your browser cache and you should see the trending playlist!');
  } else {
    console.log('\n⚠️  Some issues detected. Fix them before checking frontend.');
  }
  
  console.log('\n');
}

main().catch(console.error);
