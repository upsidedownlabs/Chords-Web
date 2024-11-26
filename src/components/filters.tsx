
//Notch Filter 50Hz/60Hz
export class Filters {
    // Properties to hold the state of the filter
    private z1: number;
    private z2: number;
    private x1: number;
    private x2: number;
    private x3: number;
    private x4: number;

    constructor() {
        // Initialize state variables
        this.z1 = 0;
        this.z2 = 0;

        this.x1 = 0;
        this.x2 = 0;
        this.x3 = 0;
        this.x4 = 0;

    }
    //sample 1.500 2.250
    //TYPE 1.ECG
    //2.EOG
    //3.EEG
    //4.EMG


    // Method to apply the filter
    process(input: number, type: number, sample: number): number {
        let output = input;
        switch (sample) {
            //samplerate 500Hz
            case 1:
                switch (type) {
                    case 1: // ECG Sampling rate: 500.0 Hz, frequency: 30.0 Hz.
                        // Filter is order 2, implemented as second-order sections (biquads).
                        this.x1 = output - (-1.47548044 * this.z1) - (0.58691951 * this.z2);
                        output = 0.02785977 * this.x1 + 0.05571953 * this.z1 + 0.02785977 * this.z2;
                        this.z2 = this.z1;
                        this.z1 = this.x1;
                        console.log("ecg500");
                        break;
                    case 2: // EOG Sampling rate: 500.0 Hz, frequency: 10.0 Hz.
                        // Filter is order 2, implemented as second-order sections (biquads).
                        this.x2 = output - (-1.82269493 * this.z1) - (0.83718165 * this.z2);
                        output = 0.00362168 * this.x2 + 0.00724336 * this.z1 + 0.00362168 * this.z2;
                        this.z2 = this.z1;
                        this.z1 = this.x2;
                        console.log("eog500");
                        break;

                    case 3: // EEG Sampling rate: 500.0 Hz, frequency: 45.0 Hz.
                        // Filter is order 2, implemented as second-order sections (biquads).
                        this.x3 = output - (-0.51930341 * this.z1) - (0.21965398 * this.z2);
                        output = 0.17508764 * this.x3 + 0.35017529 * this.z1 + 0.17508764 * this.z2;
                        this.z2 = this.z1;
                        this.z1 = this.x3;
                        console.log("eeg500");
                        break;

                    case 4: // EMG Sampling rate: 500.0 Hz, frequency: 70.0 Hz.
                        // Filter is order 2, implemented as second-order sections (biquads).
                        this.x4 = output - (-0.82523238 * this.z1) - (0.29463653 * this.z2);
                        output = 0.52996723 * this.x4 + -1.05993445 * this.z1 + 0.52996723 * this.z2;
                        this.z2 = this.z1;
                        this.z1 = this.x4;
                        console.log("emg500");
                        break;

                    default:
                        break;
                }
                break;
            case 2:
                //samplerate 250Hz
                switch (type) {
                    case 1: // ECG Sampling rate: 250.0 Hz, frequency: 30.0 Hz.
                        // Filter is order 2, implemented as second-order sections (biquads).
                        this.x1 = output - -0.98240579 * this.z1 - 0.34766539 * this.z2;
                        output = 0.09131490 * this.x1 + 0.18262980 * this.z1 + 0.09131490 * this.z2;
                        this.z2 = this.z1;
                        this.z1 = this.x1;
                        console.log("ecg250");
                        break;

                    case 2: // EOG Sampling rate: 250.0 Hz, frequency: 10.0 Hz.
                        // Filter is order 2, implemented as second-order sections (biquads).
                        this.x2 = output - -1.64745998 * this.z1 - 0.70089678 * this.z2;
                        output = 0.01335920 * this.x2 + 0.02671840 * this.z1 + 0.01335920 * this.z2;
                        this.z2 = this.z1;
                        this.z1 = this.x2;
                        console.log("eog250");
                        break;

                    case 3: // EEG Sampling rate: 250.0 Hz, frequency: 45.0 Hz.
                        // Filter is order 2, implemented as second-order sections (biquads).
                        this.x3 = output - -0.51930341 * this.z1 - 0.21965398 * this.z2;
                        output = 0.17508764 * this.x3 + 0.35017529 * this.z1 + 0.17508764 * this.z2;
                        this.z2 = this.z1;
                        this.z1 = this.x3;
                        console.log("eeg250");
                        break;

                    case 4: // EMG Sampling rate: 250.0 Hz, frequency: 70.0 Hz.
                        // Filter is order 2, implemented as second-order sections (biquads).
                        this.x4 = output - 0.22115344 * this.z1 - 0.18023207 * this.z2;
                        output = 0.23976966 * this.x4 + -0.47953932 * this.z1 + 0.23976966 * this.z2;
                        this.z2 = this.z1;
                        this.z1 = this.x4;
                        console.log("emg250");
                        break;

                    default:
                        break;
                }
                break;
            default:
                break;

        }
        return output;
    }
}



export class Notch {
    // Properties to hold the state of the filter sections
    private z1_1: number;
    private z2_1: number;

    private z1_2: number;
    private z2_2: number;

    private x_1: number;
    private x_2: number;

    constructor() {
        // Initialize state variables for both filter sections
        this.z1_1 = 0;
        this.z2_1 = 0;

        this.z1_2 = 0;
        this.z2_2 = 0;

        this.x_1 = 0;
        this.x_2 = 0;
    }

    // Method to apply the filter
    process(input: number, type: number, sample: number): number {
        let output = input;
        console.log(type);
        switch (sample) {
            case 1: // 500Hz
                switch (type) {
                    case 1: // Notch Sampling rate: 500.0 Hz, frequency: [48.0, 52.0] Hz.
                        this.x_1 = output - (-1.56858163 * this.z1_1) - (0.96424138 * this.z2_1);
                        output = 0.96508099 * this.x_1 + -1.56202714 * this.z1_1 + 0.96508099 * this.z2_1;
                        this.z2_1 = this.z1_1;
                        this.z1_1 = this.x_1;
                        console.log("50notch500");
                        // Second filter section
                        this.x_2 = output - (-1.61100358 * this.z1_2) - (0.96592171 * this.z2_2);
                        output = 1.0 * this.x_2 + -1.61854514 * this.z1_2 + 1.0 * this.z2_2;
                        this.z2_2 = this.z1_2;
                        this.z1_2 = this.x_2;
                        break;
                    case 2: // Notch Sampling rate: 500.0 Hz, frequency: [58.0, 62.0] Hz.
                        this.x_1 = output - (-1.40810535 * this.z1_1) - (0.96443153 * this.z2_1);
                        output = 0.96508099 * this.x_1 + (-1.40747202 * this.z1_1) + (0.96508099 * this.z2_1);
                        this.z2_1 = this.z1_1;
                        this.z1_1 = this.x_1;
                        console.log("60notch500");
                        // Second filter section
                        this.x_2 = output - (-1.45687509 * this.z1_2) - (0.96573127 * this.z2_2);
                        output = 1.00000000 * this.x_2 + (-1.45839783 * this.z1_2) + (1.00000000 * this.z2_2);
                        this.z2_2 = this.z1_2;
                        this.z1_2 = this.x_2;
                        break;
                    default:
                        break;
                }
                break;

            case 2: // 250Hz
                switch (type) {
                    case 1: // Notch Sampling rate: 250.0 Hz, frequency: [48.0, 52.0] Hz.
                        this.x_1 = output - (-0.53127491 * this.z1_1) - (0.93061518 * this.z2_1);
                        output = 0.93137886 * this.x_1 + (-0.57635175 * this.z1_1) + 0.93137886 * this.z2_1;
                        this.z2_1 = this.z1_1;
                        this.z1_1 = this.x_1;

                        // Second filter section
                        this.x_2 = output - (-0.66243374 * this.z1_2) - (0.93214913 * this.z2_2);
                        output = 1.00000000 * this.x_2 + (-0.61881558 * this.z1_2) + 1.00000000 * this.z2_2;
                        this.z2_2 = this.z1_2;
                        this.z1_2 = this.x_2;
                        break;

                    case 2: // Notch Sampling rate: 250.0 Hz, frequency: [58.0, 62.0] Hz.
                        this.x_1 = output - (-0.05269865 * this.z1_1) - (0.93123336 * this.z2_1);
                        output = 0.93137886 * this.x_1 + (-0.11711144 * this.z1_1) + 0.93137886 * this.z2_1;
                        this.z2_1 = this.z1_1;
                        this.z1_1 = this.x_1;

                        // Second filter section
                        this.x_2 = output - (-0.18985625 * this.z1_2) - (0.93153034 * this.z2_2);
                        output = 1.00000000 * this.x_2 + (-0.12573985 * this.z1_2) + 1.00000000 * this.z2_2;
                        this.z2_2 = this.z1_2;
                        this.z1_2 = this.x_2;
                        break;

                    default:
                        break;
                }
                break;

            default:
                break;
        }

        return output;
    }
}




// <TooltipProvider>
// <Tooltip>
//   <div className="flex items-center mx-0 px-0">
//     {/* Decrease Canvas Button */}
//     <Tooltip>
//       <TooltipTrigger asChild>
//         <Button
//           className="rounded-xl rounded-r-none"
//           onClick={decreaseCanvas}
//           disabled={canvasCount === 1 || !isDisplay || recData}
//         >
//           <Minus size={16} />
//         </Button>
//       </TooltipTrigger>
//       <TooltipContent>
//         <p>
//           {canvasCount === 1
//             ? "At Least One Canvas Required"
//             : "Decrease Channel"}
//         </p>
//       </TooltipContent>
//     </Tooltip>

//     <Separator orientation="vertical" className="h-full" />

//     {/* Toggle All Channels Button */}
//     <Tooltip>
//       <TooltipTrigger asChild>
//         <Button
//           className="flex items-center justify-center px-3 py-2 rounded-none select-none"
//           onClick={toggleShowAllChannels}
//           disabled={!isDisplay || recData}
//         >
//           CH
//         </Button>
//       </TooltipTrigger>
//       <TooltipContent>
//         <p>
//           {showAllChannels
//             ? "Hide All Channels"
//             : "Show All Channels"}
//         </p>
//       </TooltipContent>
//     </Tooltip>

//     <Separator orientation="vertical" className="h-full" />

//     {/* Increase Canvas Button */}
//     <Tooltip>
//       <TooltipTrigger asChild>
//         <Button
//           className="rounded-xl rounded-l-none"
//           onClick={increaseCanvas}
//           disabled={canvasCount >= 6 || !isDisplay || recData}
//         >
//           <Plus size={16} />
//         </Button>
//       </TooltipTrigger>
//       <TooltipContent>
//         <p>
//           {canvasCount >= 6
//             ? "Maximum Channels Reached"
//             : "Increase Channel"}
//         </p>
//       </TooltipContent>
//     </Tooltip>
//   </div>
// </Tooltip>
// </TooltipProvider>
// {isConnected && (
//     <Popover
//       open={isFilterPopoverOpen}
//       onOpenChange={setIsFilterPopoverOpen}
//     >
//       <PopoverTrigger asChild>
//         <Button
//           className="flex items-center justify-center px-3 py-2 select-none min-w-12 whitespace-nowrap rounded-xl"
//           disabled={!isDisplay}

//         >
//           Filter
//         </Button>
//       </PopoverTrigger>
//       <PopoverContent className="w-50 p-4 mx-4 mb-2">
//         <div className="flex flex-col ">
//           <div className="flex items-center pb-2 ">
//             {/* Filter Name */}
//             <div className="text-sm font-semibold w-12"><ReplaceAll size={20} /></div>
//             {/* Buttons */}
//             <div className="flex space-x-2">
//               <Button
//                 variant="outline"
//                 size="sm"
//                 onClick={() => removebioFilterFromAllChannels([0, 1, 2, 3, 4, 5])}
//                 className={
//                   Object.keys(appliedbioFiltersRef.current).length === 0
//                     ? "bg-red-700 hover:bg-white-500 text-white" // Disabled background
//                     : "bg-white-500" // Active background
//                 }
//               >
//                 <CircleOff size={17} />
//               </Button>
//               <Button
//                 variant="outline"
//                 size="sm"
//                 onClick={() => applybioFilterToAllChannels([0, 1, 2, 3, 4, 5], 4)}
//                 className={
//                   Object.keys(appliedbioFiltersRef.current).length === 6 && Object.values(appliedbioFiltersRef.current).every((value) => value === 4)
//                     ? "bg-green-700 hover:bg-white-500 text-white hover:text-white" // Disabled background
//                     : "bg-white-500" // Active background
//                 }
//               >
//                 <BicepsFlexed size={17} />
//               </Button> <Button
//                 variant="outline"
//                 size="sm"
//                 onClick={() => applybioFilterToAllChannels([0, 1, 2, 3, 4, 5], 3)}
//                 className={
//                   Object.keys(appliedbioFiltersRef.current).length === 6 && Object.values(appliedbioFiltersRef.current).every((value) => value === 3)
//                     ? "bg-green-700 hover:bg-white-500 text-white hover:text-white" // Disabled background
//                     : "bg-white-500" // Active background
//                 }
//               >
//                 <Brain size={17} />
//               </Button> <Button
//                 variant="outline"
//                 size="sm"
//                 onClick={() => applybioFilterToAllChannels([0, 1, 2, 3, 4, 5], 1)}
//                 className={
//                   Object.keys(appliedbioFiltersRef.current).length === 6 && Object.values(appliedbioFiltersRef.current).every((value) => value === 1)
//                     ? "bg-green-700 hover:bg-white-500 text-white hover:text-white" // Disabled background
//                     : "bg-white-500" // Active background
//                 }
//               >
//                 <Heart size={17} />
//               </Button> <Button
//                 variant="outline"
//                 size="sm"
//                 onClick={() => applybioFilterToAllChannels([0, 1, 2, 3, 4, 5], 2)}
//                 className={
//                   Object.keys(appliedbioFiltersRef.current).length === 6 && Object.values(appliedbioFiltersRef.current).every((value) => value === 2)
//                     ? "bg-green-700 hover:bg-white-500 text-white hover:text-white" // Disabled background
//                     : "bg-white-500" // Active background
//                 }
//               >
//                 <Eye size={17} />
//               </Button>
//               <Button
//                 variant="outline"
//                 size="sm"
//                 onClick={() => removeFilterFromAllChannels([0, 1, 2, 3, 4, 5])}
//                 className={
//                   Object.keys(appliedFiltersRef.current).length === 0
//                     ? "bg-red-700 hover:bg-white-500 text-white" // Disabled background
//                     : "bg-white-500" // Active background
//                 }
//               >
//                 <CircleOff size={17} />
//               </Button>

//               <Button
//                 variant="outline"
//                 size="sm"
//                 onClick={() => applyFilterToAllChannels([0, 1, 2, 3, 4, 5], 1)}
//                 className={
//                   Object.keys(appliedFiltersRef.current).length === 6 && Object.values(appliedFiltersRef.current).every((value) => value === 1)
//                     ? "bg-green-700 hover:bg-white-500 text-white hover:text-white" // Disabled background
//                     : "bg-white-500" // Active background
//                 }
//               >
//                 50Hz
//               </Button>
//               <Button
//                 variant="outline"
//                 size="sm"
//                 onClick={() => applyFilterToAllChannels([0, 1, 2, 3, 4, 5], 2)}
//                 className={
//                   Object.keys(appliedFiltersRef.current).length === 6 && Object.values(appliedFiltersRef.current).every((value) => value === 2)
//                     ? "bg-green-700 hover:bg-white-500 text-white hover:text-white" // Disabled background
//                     : "bg-white-500" // Active background
//                 }
//               >
//                 60Hz
//               </Button>
//             </div>
//           </div>
//           <div className="flex flex-col space-y-2">
//             {["CH1", "CH2", "CH3", "CH4", "CH5", "CH6"].map((filterName, index) => (
//               <div key={filterName} className="flex items-center">
//                 {/* Filter Name */}
//                 <div className="text-sm font-semibold w-12">{filterName}</div>

//                 {/* Buttons */}
//                 <div className="flex space-x-2">
//                   <Button
//                     variant="outline"
//                     size="sm"
//                     onClick={() => removebioFilter(index)}
//                     className={
//                       appliedbioFiltersRef.current[index] === undefined
//                         ? "bg-red-700 hover:bg-white-500 text-white" // Disabled background
//                         : "bg-white-500" // Active background
//                     }
//                   >
//                     <CircleOff size={17} />
//                   </Button>
//                   <Button
//                     variant="outline"
//                     size="sm"
//                     onClick={() => handleFrequencySelectionbio(index, 4)}
//                     className={
//                       appliedbioFiltersRef.current[index] === 4
//                         ? "bg-green-700 hover:bg-white-500 text-white hover:text-white" // Disabled background
//                         : "bg-white-500" // Active background
//                     }
//                   >
//                     <BicepsFlexed size={17} />
//                   </Button> <Button
//                     variant="outline"
//                     size="sm"
//                     onClick={() => handleFrequencySelectionbio(index, 3)}
//                     className={
//                       appliedbioFiltersRef.current[index] === 3
//                         ? "bg-green-700 hover:bg-white-500 text-white hover:text-white" // Disabled background
//                         : "bg-white-500" // Active background
//                     }
//                   >
//                     <Brain size={17} />
//                   </Button> <Button
//                     variant="outline"
//                     size="sm"
//                     onClick={() => handleFrequencySelectionbio(index, 1)}
//                     className={
//                       appliedbioFiltersRef.current[index] === 1
//                         ? "bg-green-700 hover:bg-white-500 text-white hover:text-white" // Disabled background
//                         : "bg-white-500" // Active background
//                     }
//                   >
//                     <Heart size={17} />
//                   </Button> <Button
//                     variant="outline"
//                     size="sm"
//                     onClick={() => handleFrequencySelectionbio(index, 2)}
//                     className={
//                       appliedbioFiltersRef.current[index] === 2
//                         ? "bg-green-700 hover:bg-white-500 text-white hover:text-white" // Disabled background
//                         : "bg-white-500" // Active background
//                     }
//                   >
//                     <Eye size={17} />
//                   </Button>
//                   <Button
//                     variant="outline"
//                     size="sm"
//                     onClick={() => removeFilter(index)}
//                     className={
//                       appliedFiltersRef.current[index] === undefined
//                         ? "bg-red-700 hover:bg-white-500 text-white" // Disabled background
//                         : "bg-white-500" // Active background
//                     }
//                   >
//                     <CircleOff size={17} />
//                   </Button>

//                   <Button
//                     variant="outline"
//                     size="sm"
//                     onClick={() => handleFrequencySelection(index, 1)}
//                     className={
//                       appliedFiltersRef.current[index] === 1
//                         ? "bg-green-700 hover:bg-white-500 text-white hover:text-white" // Disabled background
//                         : "bg-white-500" // Active background
//                     }
//                   >
//                     50Hz
//                   </Button>
//                   <Button
//                     variant="outline"
//                     size="sm"
//                     onClick={() => handleFrequencySelection(index, 2)}
//                     className={
//                       appliedFiltersRef.current[index] === 2
//                         ? "bg-green-700 hover:bg-white-500 text-white hover:text-white" // Disabled background
//                         : "bg-white-500" // Active background
//                     }
//                   >
//                     60Hz
//                   </Button>
//                 </div>
//               </div>
//             ))}
//           </div>
//         </div>
//       </PopoverContent>

//     </Popover>
//   )}
