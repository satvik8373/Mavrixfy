import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';

import { cn } from '@/lib/utils';

import { TabsList } from './TabsList';
import { TabsTrigger } from './TabsTrigger';
import { TabsContent } from './TabsContent';

const Tabs = TabsPrimitive.Root;

export { Tabs, TabsList, TabsTrigger, TabsContent };
